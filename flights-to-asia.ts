import { FlightRadar24API } from "flightradarapi";
import { countries, majorAirports } from "./open-asia";
import { fowardLookup } from "./operations/forward-lookup";

const api = new FlightRadar24API();

const sourceAirport = "BKK";
const destinationAirports = countries.flatMap((c) => majorAirports[c] ?? []);
await fowardLookup(api, sourceAirport, destinationAirports, false);
