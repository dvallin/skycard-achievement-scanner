import { FlightRadar24API } from "flightradarapi";
import heavyWeights from "./heavy-weight";
import speedDemon from "./speed-demon";
import { flightsByTypes } from "../operations/flights-by-type";

const api = new FlightRadar24API();

const ham = await api.getAirport("HAM");
const dxb = await api.getAirport("DXB");
await flightsByTypes(api, [ham, dxb], [...heavyWeights, ...speedDemon]);
