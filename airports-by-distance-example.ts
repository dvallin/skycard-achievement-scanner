import { FlightRadar24API } from "flightradarapi";
import { airportsByDistance } from "./operations/airports-by-distance";

const api = new FlightRadar24API();

// Example: Find source airports for arrivals at major European hubs
// and sort them by distance from Copenhagen (CPH)
const targetAirports = ["CPH", "ARN", "OSL", "HEL", "GOT"];
const originAirport = "CPH";

await airportsByDistance(api, targetAirports, originAirport, true);
