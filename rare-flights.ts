import { FlightRadar24API } from "flightradarapi";
import { flightsByTypes } from "./operations/flights-by-type";

const api = new FlightRadar24API();

const remainingAircrafts = [
  "SONX",
  "PA23",
  "CRER",
  "H53S",
  "GA6C",
  "EAGL",
  "BE99",
  "BE10",
  "C205",
  "C205",
  "V22",
  "T204",
  "VR7",
];

const sourceAirport = await api.getAirport("HAM");
await flightsByTypes(api, sourceAirport, remainingAircrafts);
