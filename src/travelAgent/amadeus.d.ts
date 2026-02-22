declare module 'amadeus' {
  type AmadeusResponse = { data: Record<string, unknown>[] };
  type GetFn = (params: Record<string, string>) => Promise<AmadeusResponse>;

  export default class Amadeus {
    constructor(config: { clientId: string; clientSecret: string });

    shopping: {
      flightOffersSearch: { get: GetFn };
      hotelOffersSearch:  { get: GetFn };
      activities:         { get: GetFn };
    };

    referenceData: {
      locations: {
        get: GetFn;
        hotels: {
          byCity:    { get: GetFn };
          byGeocode: { get: GetFn };
        };
      };
    };
  }
}