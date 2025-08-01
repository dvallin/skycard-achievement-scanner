import { FlightRadar24API } from "flightradarapi";
import { countries } from "./open-asia";
import { forwardSearch } from "./operations/forward-lookup";
import { airportsOfCountries } from "./operations/airports-of-countries";

const api = new FlightRadar24API();

const sourceAirport = "IST";
const destinationAirports = await airportsOfCountries(api, countries);
await forwardSearch(api, sourceAirport, destinationAirports);
