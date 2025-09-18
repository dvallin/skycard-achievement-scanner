import { FlightRadar24API } from "flightradarapi";
import heavyWeights from "./heavy-weight";
import speedDemon from "./speed-demon";
import { flightsByTypes } from "../operations/flights-by-type";

const api = new FlightRadar24API();

const ham = await api.getAirport("HAM");
const dxb = await api.getAirport("DXB");
const lax = await api.getAirport("LAX");
const hi = await api.getAirport("HNL");
await flightsByTypes(
  api,
  [ham, dxb, lax, hi],
  [...heavyWeights, ...speedDemon],
);
