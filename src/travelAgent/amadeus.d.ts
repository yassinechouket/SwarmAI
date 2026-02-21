declare module 'amadeus' {
  export default class Amadeus {
    constructor(config: { clientId: string; clientSecret: string });
    shopping: {
      flightOffersSearch: { get: (params: any) => Promise<any> };
      hotelOffersSearch: { get: (params: any) => Promise<any> };
      activities: { get: (params: any) => Promise<any> };
    };
  }
}