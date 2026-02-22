import "dotenv/config";
import { streamText, type ModelMessage, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";
import { z } from "zod";
import { SYSTEM_PROMPT } from "./system/prompt.ts";
import {
  estimateMessagesTokens,
  getModelLimits,
  isOverThreshold,
  calculateUsagePercentage,
  compactConversation,
  DEFAULT_THRESHOLD,
} from "../travelAgent/context/index.ts";
import { filterCompatibleMessages } from "../travelAgent/system/filterMessages.ts";
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";

import { runAgent as runTravelAgent } from "../travelAgent/run.ts";
import { runAgent as runEmailAgent } from "../emailAgent/run.ts";
import { runAgent as runSearchAgent } from "../searchAgent/run.ts";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

const MODEL_NAME = "gpt-4o-mini";

/**
 * Create delegation tools that wrap each specialized sub-agent.
 * Sub-agent tokens are collected silently; their tool calls are proxied
 * to the parent callbacks so the UI shows sub-agent activity.
 */
function createDelegationTools(callbacks: AgentCallbacks) {
  return {
    delegateToTravelAgent: tool({
      description:
        "Delegate travel-related tasks to the Travel Agent. Use this for: searching flights, finding hotels, recommending restaurants, and general travel planning.",
      inputSchema: z.object({
        task: z
          .string()
          .describe(
            "The specific travel task or question to answer, with all necessary details (cities, dates, etc.)",
          ),
      }),
      execute: async ({ task }) => {
        let subAgentResult = "";
        await runTravelAgent(task, [], {
          onToken: () => {
            // Sub-agent tokens are collected silently.
            // The orchestrator synthesizes the final response.
          },
          onToolCallStart: (name, args) =>
            callbacks.onToolCallStart(`travel → ${name}`, args),
          onToolCallEnd: (name, result) =>
            callbacks.onToolCallEnd(`travel → ${name}`, result),
          onComplete: (response) => {
            subAgentResult = response;
          },
          onToolApproval: callbacks.onToolApproval,
          onTokenUsage: callbacks.onTokenUsage,
        });
        return subAgentResult || "Travel agent returned no results.";
      },
    }),

    delegateToEmailAgent: tool({
      description:
        "Delegate email-related tasks to the Email Agent. Use this for: reading emails, searching emails, sending/replying to emails, and summarizing email threads.",
      inputSchema: z.object({
        task: z
          .string()
          .describe(
            "The specific email task or question, with all relevant details (recipient, subject, etc.)",
          ),
      }),
      execute: async ({ task }) => {
        let subAgentResult = "";
        await runEmailAgent(task, [], {
          onToken: () => {
            // Silent — orchestrator synthesizes.
          },
          onToolCallStart: (name, args) =>
            callbacks.onToolCallStart(`email → ${name}`, args),
          onToolCallEnd: (name, result) =>
            callbacks.onToolCallEnd(`email → ${name}`, result),
          onComplete: (response) => {
            subAgentResult = response;
          },
          onToolApproval: callbacks.onToolApproval,
          onTokenUsage: callbacks.onTokenUsage,
        });
        return subAgentResult || "Email agent returned no results.";
      },
    }),

    delegateToSearchAgent: tool({
      description:
        "Delegate web search tasks to the Search Agent. Use this for: finding current news, facts, general knowledge, and any information that benefits from a web search.",
      inputSchema: z.object({
        task: z
          .string()
          .describe("The search query or question to research on the web"),
      }),
      execute: async ({ task }) => {
        let subAgentResult = "";
        await runSearchAgent(task, [], {
          onToken: () => {
            // Silent — orchestrator synthesizes.
          },
          onToolCallStart: (name, args) =>
            callbacks.onToolCallStart(`search → ${name}`, args),
          onToolCallEnd: (name, result) =>
            callbacks.onToolCallEnd(`search → ${name}`, result),
          onComplete: (response) => {
            subAgentResult = response;
          },
          onToolApproval: callbacks.onToolApproval,
          onTokenUsage: callbacks.onTokenUsage,
        });
        return subAgentResult || "Search agent returned no results.";
      },
    }),
  };
}

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
): Promise<ModelMessage[]> {
  const modelLimits = getModelLimits(MODEL_NAME);
  const workingHistory = filterCompatibleMessages(conversationHistory);

  let messages: ModelMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...workingHistory,
    { role: "user", content: userMessage },
  ];

  let fullResponse = "";

  const preCheckTokens = estimateMessagesTokens(messages);
  if (
    isOverThreshold(
      preCheckTokens.total,
      modelLimits.contextWindow,
      DEFAULT_THRESHOLD,
    )
  ) {
    messages = await compactConversation(messages, MODEL_NAME);
  }

  // Build delegation tools with callbacks bound at call-time.
  const tools = createDelegationTools(callbacks);

  type ExecFn = (
    args: Record<string, unknown>,
    opts: { toolCallId: string; messages: ModelMessage[] },
  ) => Promise<unknown>;

  const reportTokenUsage = () => {
    if (callbacks.onTokenUsage) {
      const usage = estimateMessagesTokens(messages);
      callbacks.onTokenUsage({
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: usage.total,
        contextWindow: modelLimits.contextWindow,
        threshold: DEFAULT_THRESHOLD,
        percentage: calculateUsagePercentage(
          usage.total,
          modelLimits.contextWindow,
        ),
      });
    }
  };

  while (true) {
    const result = streamText({
      model: openai(MODEL_NAME),
      messages,
      tools,
      experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
      },
    });

    const toolCalls: ToolCallInfo[] = [];
    let currentText = "";
    let streamError: Error | null = null;

    try {
      for await (const chunk of result.fullStream) {
        if (chunk.type === "text-delta") {
          currentText += chunk.text;
          callbacks.onToken(chunk.text);
        }
        if (chunk.type === "tool-call") {
          const input = "input" in chunk ? chunk.input : {};
          toolCalls.push({
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: input as Record<string, unknown>,
          });
          callbacks.onToolCallStart(chunk.toolName, input);
        }
      }
    } catch (e) {
      streamError = e as Error;
      if (!currentText && !streamError.message.includes("No output generated")) {
        throw streamError;
      }
    }

    fullResponse += currentText;

    if (streamError && !currentText) {
      fullResponse =
        "I apologize, but I wasn't able to generate a response. Could you please try rephrasing your message?";
      callbacks.onToken(fullResponse);
      break;
    }

    const finishReason = await result.finishReason;
    if (finishReason !== "tool-calls" || toolCalls.length === 0) {
      const responseMessages = await result.response;
      messages.push(...responseMessages.messages);
      reportTokenUsage();
      break;
    }

    const responseMessages = await result.response;
    messages.push(...responseMessages.messages);

    for (const tc of toolCalls) {
      const toolFn = tools[tc.toolName as keyof typeof tools];
      let toolResult: string;

      if (toolFn?.execute) {
        try {
          const raw = await (toolFn.execute as ExecFn)(tc.args, {
            toolCallId: tc.toolCallId,
            messages,
          });
          toolResult = typeof raw === "string" ? raw : JSON.stringify(raw);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          toolResult = `Error from ${tc.toolName}: ${message}`;
        }
      } else {
        toolResult = `Tool ${tc.toolName} not found.`;
      }

      callbacks.onToolCallEnd(tc.toolName, toolResult);

      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            output: { type: "text", value: toolResult },
          },
        ],
      });

      reportTokenUsage();
    }
  }

  callbacks.onComplete(fullResponse);
  return messages;
}
