import { send } from "process";
import { searchTool } from "./travel.ts";


// All tools combined for the agent
export const tools = {
  searchTool,
  
};

// Export individual tools for selective use in evals
export { searchTool } from "./travel.ts";

// Tool sets for evals
export const fileTools = {
  searchTool,
  
};
