import { tool } from "ai"
import { z } from "zod"
import Amadeus from "amadeus"

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_API_KEY ?? "",
  clientSecret: process.env.AMADEUS_API_SECRET ?? ""
})



interface FlightSegment {
  departure: { iataCode: string; at: string }
  arrival:   { iataCode: string; at: string }
  carrierCode: string
}

interface FlightOffer {
  price: { total: string; currency: string }
  itineraries: { segments: FlightSegment[] }[]
}

interface HotelListItem { hotelId: string }

interface HotelOffer {
  hotel: { hotelId: string; name: string; rating: string }
  offers?: {
    price?: { total: string; currency: string }
    room?:  { typeEstimated?: { category: string } }
  }[]
}

interface GeoResult {
  geometry: { location: { lat: number; lng: number } }
}

interface PlaceResult {
  name: string
  rating: number
  vicinity: string
}



async function resolveCityToIata(city: string): Promise<string> {
  const response = await amadeus.referenceData.locations.get({
    keyword: city,
    subType: "CITY,AIRPORT",
    "page[limit]": "1"
  })

  if (!response.data.length) {
    throw new Error(`City not found: ${city}`)
  }

  const location = response.data[0] as { iataCode: string }
  return location.iataCode
}

export const searchFlightsTool = tool({
  name: "searchFlights",
  description: "Search flights between two cities",

  inputSchema: z.object({
    origin: z.string().describe("City or airport name, example: Tunis"),
    destination: z.string().describe("City or airport name, example: Paris"),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().min(1).default(1),
    returnDate: z.string().optional()
  }),

  execute: async ({ origin, destination, departureDate, adults, returnDate }) => {
    try {
      // STEP 1: resolve city → IATA
      const originCode = await resolveCityToIata(origin)
      const destinationCode = await resolveCityToIata(destination)

      const params: Record<string, string> = {
        originLocationCode: originCode,
        destinationLocationCode: destinationCode,
        departureDate,
        adults: adults.toString(),
        max: "5"
      }

      if (returnDate) {
        params.returnDate = returnDate
      }

      const response =
        await amadeus.shopping.flightOffersSearch.get(params)

      return (response.data as unknown as FlightOffer[]).map((flight) => ({
        price: flight.price.total,
        currency: flight.price.currency,
        departureAirport:
          flight.itineraries[0].segments[0].departure.iataCode,
        arrivalAirport:
          flight.itineraries[0].segments[0].arrival.iataCode,
        departureTime:
          flight.itineraries[0].segments[0].departure.at,
        arrivalTime:
          flight.itineraries[0].segments[0].arrival.at,
        airline:
          flight.itineraries[0].segments[0].carrierCode
      }))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Amadeus error:", message)

      return {
        error: "Failed to search flights"
      }
    }
  }
})


export const searchHotelsTool = tool({
  name: "searchHotels",
  description: "Search hotels in a city using Amadeus API",
  inputSchema: z.object({
    cityCode: z.string().describe("IATA city code, example: PAR"),
    checkInDate: z.string().describe("Format YYYY-MM-DD"),
    checkOutDate: z.string().describe("Format YYYY-MM-DD"),
    adults: z.number().min(1).default(1)
  }),

  execute: async ({ cityCode, checkInDate, checkOutDate, adults }) => {
    try {
      // Step 1 (Amadeus v11+): resolve city code → hotel IDs
      const hotelsRes = await amadeus.referenceData.locations.hotels.byCity.get({
        cityCode
      })

      if (!hotelsRes.data.length) {
        return { error: `No hotels found in city: ${cityCode}` }
      }

      // Take the first 20 hotel IDs to avoid oversized requests
      const hotelIds = (hotelsRes.data as unknown as HotelListItem[])
        .slice(0, 20)
        .map((h) => h.hotelId)
        .join(",")

      // Step 2: fetch available offers for those hotels
      const offersRes = await amadeus.shopping.hotelOffersSearch.get({
        hotelIds,
        checkInDate,
        checkOutDate,
        adults: adults.toString()
      })

      return (offersRes.data as unknown as HotelOffer[]).map((hotel) => ({
        hotelId:  hotel.hotel.hotelId,
        name:     hotel.hotel.name,
        rating:   hotel.hotel.rating,
        price:    hotel.offers?.[0]?.price?.total,
        currency: hotel.offers?.[0]?.price?.currency,
        room:     hotel.offers?.[0]?.room?.typeEstimated?.category
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Amadeus error:", message)
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
    try {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      )
      const geoData = (await geoRes.json()) as { results: GeoResult[] }
      const { lat, lng } = geoData.results[0].geometry.location

      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=restaurant&key=${process.env.GOOGLE_MAPS_API_KEY}`
      )
      const placesData = (await placesRes.json()) as { results: PlaceResult[] }

      return placesData.results.map((place) => ({
        name:    place.name,
        rating:  place.rating,
        address: place.vicinity
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Google Maps error:", message)
      return { error: "Failed to find restaurants" }
    }
  }
})