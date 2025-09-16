import { FlightRadar24API } from "flightradarapi";
import { flightsByTypes } from "./operations/flights-by-type";

const api = new FlightRadar24API();

const speedDemonAircraft = [
  "F15",
  "MRF1",
  "MIR2",
  "MIRA",
  "RFAL",
  "LCA",
  "F104",
  "F16",
  "MG29",
  "TOR",
  "SB35",
  "SB37",
];

const sourceAirport = await api.getAirport("HAM");
await flightsByTypes(api, sourceAirport, speedDemonAircraft);
