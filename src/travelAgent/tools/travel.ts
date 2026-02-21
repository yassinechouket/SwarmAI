import { tool } from "ai"
import { z } from "zod"
import Amadeus from "amadeus"

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_API_KEY!,
  clientSecret: process.env.AMADEUS_API_SECRET!
})

export const searchFlightsTool = tool({
  name: "searchFlights",
  description: "Search flights between two cities",
  inputSchema: z.object({
    origin: z.string().describe("IATA code, example: TUN"),
    destination: z.string().describe("IATA code, example: CDG"),
    date: z.string().describe("Format YYYY-MM-DD")
  }),

  execute: async ({ origin, destination, date }) => {
    try {
      const response = await amadeus.shopping.flightOffersSearch.get({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        adults: "1",
        max: "5"
      })

      
      return response.data.map((flight: any) => ({
        price: flight.price.total,
        currency: flight.price.currency,
        departure: flight.itineraries[0].segments[0].departure.iataCode,
        arrival: flight.itineraries[0].segments[0].arrival.iataCode,
        departureTime:
          flight.itineraries[0].segments[0].departure.at,
        arrivalTime:
          flight.itineraries[0].segments[0].arrival.at,
        airline:
          flight.itineraries[0].segments[0].carrierCode
      }))
    } catch (error: any) {
      console.error("Amadeus error:", error.message)
      return { error: "Failed to search flights" }
    }
  }
})


export const searchHotelsTool = tool({
  name: "searchHotels",
  description: "Search hotels in a city using Amadeus API",
  inputSchema: z.object({
    cityCode: z.string().describe("IATA city code, example: PAR"),
    checkInDate: z.string().describe("Format YYYY-MM-DD"),
    checkOutDate: z.string().describe("Format YYYY-MM-DD")
  }),

  execute: async ({ cityCode, checkInDate, checkOutDate }) => {
    try {
      const response = await amadeus.shopping.hotelOffersSearch.get({
        cityCode,
        checkInDate,
        checkOutDate,
        adults: "1",
        roomQuantity: "1"
      })

      return response.data.map((hotel: any) => ({
        name: hotel.hotel.name,
        rating: hotel.hotel.rating,
        price: hotel.offers?.[0]?.price?.total,
        currency: hotel.offers?.[0]?.price?.currency
      }))
    } catch (error: any) {
      console.error("Amadeus error:", error.message)
      return { error: "Failed to search hotels" }
    }
  }
})



export const searchRestaurantsTool = tool({
  name: "searchRestaurants",
  description: "Find restaurants in a city",
  inputSchema: z.object({
    city: z.string()
  }),

  execute: async ({ city }) => {
    const geoRes: any = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${city}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    )

    const geoData = await geoRes.json()
    const { lat, lng } = geoData.results[0].geometry.location

    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=restaurant&key=${process.env.GOOGLE_MAPS_API_KEY}`
    )

    const placesData: any = await placesRes.json()

    return placesData.results.map((place: any) => ({
      name: place.name,
      rating: place.rating,
      address: place.vicinity
    }))
  }
})