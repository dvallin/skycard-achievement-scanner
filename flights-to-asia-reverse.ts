import { FlightRadar24API } from "flightradarapi";
import { backwardLookup } from "./operations/backward-lookup";
import { countries } from "./open-asia";
import { airportsOfCountries } from "./operations/airports-of-countries";

const api = new FlightRadar24API();

const currentAirports = await airportsOfCountries(api, countries);
await backwardLookup(api, currentAirports);
