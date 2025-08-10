import { FlightRadar24API } from "flightradarapi";
import { airportsByDistance } from "./operations/airports-by-distance";
import { countries, majorAirports } from "./open-asia";

const api = new FlightRadar24API();

// Get all destination airports from the open-asia configuration
const destinationAirports = countries.flatMap((c) => majorAirports[c] ?? []);

const originAirport = "HAM";

console.log("🌏 Asia Hub Analysis: Remote Asian Destinations");
console.log(`Target airports: ${destinationAirports.join(", ")}`);

await airportsByDistance(api, destinationAirports, originAirport, false);
