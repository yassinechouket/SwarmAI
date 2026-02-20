import { send } from "process";
import { searchTool } from "./search.ts";


// All tools combined for the agent
export const tools = {
  searchTool,
  
};

// Export individual tools for selective use in evals
export { searchTool } from "./search.ts";

// Tool sets for evals
export const fileTools = {
  searchTool,
  
};
