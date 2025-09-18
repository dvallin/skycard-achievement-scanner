import { FlightRadar24API } from "flightradarapi";
import { flightsByTypes } from "./operations/flights-by-type";

const api = new FlightRadar24API();

const remainingAircrafts = ["H53S"];

const sourceAirport = await api.getAirport("HAM");
await flightsByTypes(api, [sourceAirport], remainingAircrafts);
