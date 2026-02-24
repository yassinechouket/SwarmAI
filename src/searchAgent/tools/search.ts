import { tavily } from '@tavily/core';
import { tool } from "ai";
import { z } from "zod";
import { ChromaClient } from "chromadb";
import { embed } from "ai";

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

export const searchTool = tool({
  name: 'search',
  description: 'Use this tool to search the web for information.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    const response = await tavilyClient.search(query);
    
    
    return {
      query: response.query,
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      })),
    };
  },
});


