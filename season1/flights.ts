import { FlightRadar24API } from "flightradarapi";
import heavyweights from "./heavy-weight";
import { flightsByTypes } from "../operations/flights-by-type";

const api = new FlightRadar24API();

const ham = await api.getAirport("HAM");
const dxb = await api.getAirport("DXB");
await flightsByTypes(api, [ham, dxb], heavyweights);
