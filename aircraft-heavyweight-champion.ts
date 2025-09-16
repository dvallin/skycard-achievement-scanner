import { FlightRadar24API } from "flightradarapi";
import { flightsByTypes } from "./operations/flights-by-type";

const api = new FlightRadar24API();

const heavyweightChampionAircraft = [
  "A345",
  "A346",
  "A388",
  "A124",
  "B742",
  "B743",
  "B744",
  "B748",
  "B77W",
  "BLCF",
  "C5M",
  "SLCH",
];

const sourceAirport = await api.getAirport("HAM");
await flightsByTypes(api, sourceAirport, heavyweightChampionAircraft);
