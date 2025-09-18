import { FlightRadar24API } from "flightradarapi";
import { fowardLookup } from "./operations/forward-lookup";
import { countries, majorAirports } from "./open-oceania";

const api = new FlightRadar24API();

const source = "NAN";
const destinationAirports = countries.flatMap((c) => majorAirports[c] ?? []);
await fowardLookup(api, source, destinationAirports, false);
