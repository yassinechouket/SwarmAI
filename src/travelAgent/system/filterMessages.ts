import type { ModelMessage } from "ai";
/**
 * Filter conversation history to only include compatible message formats.
 * Provider tools (like webSearch) may return messages with formats that
 * cause issues when passed back to subsequent API calls.
 */
export const filterCompatibleMessages = (
  messages: ModelMessage[],
): ModelMessage[] => {
  return messages.filter((msg) => {
    // Keep user and system messages
    if (msg.role === "user" || msg.role === "system") {
      return true;
    }

    // Keep all assistant messages — including pure tool-call turns.
    // Dropping tool-call-only assistant messages breaks the conversation:
    // the subsequent tool-result messages reference call IDs that the API
    // can no longer find, producing "No tool call found for call_id …".
    if (msg.role === "assistant") {
      const content = msg.content;
      if (typeof content === "string") return content.trim().length > 0;
      if (Array.isArray(content) && content.length > 0) return true;
    }

    // Keep tool messages
    if (msg.role === "tool") {
      return true;
    }

    return false;
  });
};
