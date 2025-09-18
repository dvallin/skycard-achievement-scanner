import { FlightRadar24API } from "flightradarapi";
import { flightsBetweenPairs } from "../operations/flights-between-pairs";
import longHauler from "./long-hauler";

const api = new FlightRadar24API();
await flightsBetweenPairs(api, longHauler);
