import { FlightRadar24API } from "flightradarapi";
import { backwardLookup } from "./operations/backward-lookup";
import { countries, majorAirports } from "./open-asia";

const api = new FlightRadar24API();

const destinationAirports = countries.flatMap((c) => majorAirports[c] ?? []);
await backwardLookup(api, destinationAirports, false);
