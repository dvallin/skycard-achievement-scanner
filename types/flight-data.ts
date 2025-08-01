export type FlightData = {
  identification: {
    id: string | null;
    row: number;
    number: { default: string; alternative: string | null };
    callsign: string;
    codeshare: string[] | null;
  };
  status: {
    live: boolean;
    text: string;
    icon: string;
    estimated: number | null;
    ambiguous: boolean;
    generic: {
      status: {
        text: string;
        type: string;
        color: string;
        diverted: string | null;
      };
      eventTime: { utc: number; local: number };
    };
  };
  aircraft?: {
    model: { code: string; text: string };
    registration: string;
    country: {
      id: number | null;
      name: string | null;
      alpha2: string | null;
      alpha3: string | null;
    };
    hex: string;
    restricted: boolean;
    serialNo: string | null;
    age: { availability: boolean };
    availability: { serialNo: boolean; age: boolean };
    onGroundUpdate?: number;
    hoursDiff?: number;
    timeDiff?: number;
  };
  owner: {
    name: string;
    code: { iata: string; icao: string };
    logo: string;
  };
  airline: {
    name: string;
    code: { iata: string; icao: string };
    short: string;
  };
  airport: {
    origin?: FlightAirportInfo;
    destination?: FlightAirportInfo;
    real?: any;
  };
  time?: {
    scheduled: { departure: number; arrival: number };
    real: { departure: number | null; arrival: number | null };
    estimated: { departure: number | null; arrival: number | null };
    other: { eta: number | null; duration: number | null };
  };
};

type FlightAirportInfo = {
  code?: { iata: string; icao: string };
  timezone: {
    name: string;
    offset: number;
    abbr: string;
    abbrName: string | null;
    isDst: boolean;
  };
  info: {
    terminal: string | null;
    baggage: string | null;
    gate: string | null;
  };
  name?: string;
  position?: {
    latitude: number;
    longitude: number;
    country: { name: string; code: string; id: number };
    region: { city: string };
  };
  visible?: boolean;
};
