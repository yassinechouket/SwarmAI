import { send } from "process";
import { readEmailsTool,searchEmailsTool,sendEmailTool,summarizeEmailsTool } from "./emails.ts";


// All tools combined for the agent
export const tools = {
  readEmailsTool,
  searchEmailsTool,
  sendEmailTool,
  summarizeEmailsTool
};

// Export individual tools for selective use in evals
export { readEmailsTool,searchEmailsTool,sendEmailTool,summarizeEmailsTool } from "./emails.ts";

// Tool sets for evals
export const fileTools = {
  readEmailsTool,
  searchEmailsTool,
  summarizeEmailsTool,
  sendEmailTool
};
