import { send } from "process";
import { searchFlightsTool,searchHotelsTool,searchRestaurantsTool } from "./travel.ts";


// All tools combined for the agent
export const tools = {
  searchFlightsTool,
  searchHotelsTool,
  searchRestaurantsTool
  
};

// Export individual tools for selective use in evals
export { searchFlightsTool,searchHotelsTool,searchRestaurantsTool  } from "./travel.ts";

// Tool sets for evals
export const fileTools = {
  searchFlightsTool,
  searchHotelsTool,
  searchRestaurantsTool
  
};
