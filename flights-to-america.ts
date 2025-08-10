import { FlightRadar24API } from "flightradarapi";
import { countries, majorAirports } from "./open-america";
import { fowardLookup } from "./operations/forward-lookup";

const api = new FlightRadar24API();

const sourceAirport = "CPH";
const destinationAirports = countries.flatMap((c) => majorAirports[c] ?? []);
await fowardLookup(api, sourceAirport, destinationAirports, false);
