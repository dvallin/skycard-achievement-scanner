import { FlightRadar24API, Airport, FlightTrackerConfig } from "flightradarapi";
import heavyWeights from "./heavy-weight";
import speedDemon from "./speed-demon";
import { flightsByTypes } from "../operations/flights-by-type";

const api = new FlightRadar24API();

const homeAirports = ["HAM", "DXB", "LAX", "HNL", "JHB"];
const airports: Airport[] = [];
for (const code of homeAirports) {
  airports.push(await api.getAirport(code));
}
await flightsByTypes(api, airports, [...heavyWeights, ...speedDemon]);
