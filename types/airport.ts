import type { FlightData } from "./flight-data";

type DelayStats = {
  delayIndex: number;
  delayAvg: number;
  pecentage: { delayed: number; canceled: number; trend: string };
  recent: {
    delayIndex: number;
    delayAvg: number;
    pecentage: { delayed: number; canceled: number; trend: string };
    quantity: { onTime: number; delayed: number; canceled: number };
  };
  today: {
    percentage: { delayed: number; canceled: number };
    quantity: { onTime: number; delayed: number; canceled: number };
  };
  yesterday: {
    percentage: { delayed: number; canceled: number };
    quantity: { onTime: number; delayed: number; canceled: number };
  };
  tomorrow: {
    percentage: { canceled: number };
    quantity: { canceled: number };
  };
};
type Image = {
  src: string;
  link: string;
  copyright: string;
  source: string;
};

type AirportDetails = {
  name: string;
  code: { iata: string; icao: string };
  delayIndex: { arrivals: number; departures: number };
  stats: {
    arrivals: DelayStats;
    departures: DelayStats;
  };
  position: {
    latitude: number;
    longitute: number;
    elevation: number;
    country: {
      name: string;
      code: string;
      id: number;
    };
    region: {
      city: string;
    };
  };
  timezone: {
    name: string;
    offset: number;
    abbr: string;
    abbrName: string;
    isDst: boolean;
  };
  url: {
    homepage: string;
    webcam: string;
    wikipedia: string;
  };
  airportImages: {
    thumbnails: Image[];
    medium: Image[];
  };
  visible: boolean;
};

type AirportAircraftCount = {
  ground: number;
  onGround: {
    visible: number;
    total: number;
  };
};

type PluginData = {
  details: AirportDetails;
  flightdiary: AirportFlightDiaryFull;
  schedule: AirportScheduleFull;
  weather: AirportWeather;
  aircraftCount: AirportAircraftCount;
  runways: Runway[];
};

type AirportFlightDiaryFull = {
  url: string;
  ratings: { avg: number; total: number };
  comment: {
    content: string;
    author: { facebookId: string | null; name: string };
    timestamp: number;
  }[];
  reviews: number;
  evaluation: number;
};

type AirportScheduleFull = {
  arrivals: AirportScheduleSection;
  departures: AirportScheduleSection;
  ground: AirportScheduleSection;
};

type AirportScheduleSection = {
  item: {
    current: number;
    total: number;
    limit: number;
  };
  page: {
    current: number;
    total: number;
  };
  timestamp: number;
  data: {
    flight: FlightData;
  }[];
};

type AirportWeather = {
  metar: string;
  time: number;
  qnh: number;
  dewpoint: { celsius: number; fahrenheit: number };
  humidity: number;
  pressure: { hg: number; hpa: number };
  sky: {
    condition: { text: string };
    visibility: { km: number; mi: number; nmi: number };
  };
  flight: { category: string };
  wind: {
    direction: { degree: number; text: string };
    speed: { kmh: number; kts: number; mph: number; text: string };
  };
  temp: { celsius: number; fahrenheit: number };
  elevation: { m: number; ft: number };
  cached: number;
};

type Runway = {
  name: string;
  length: { ft: number; m: number };
  surface: { code: string; name: string };
};

export type Airport = {
  pluginData: PluginData;
};
