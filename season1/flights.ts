import { FlightRadar24API } from "flightradarapi";
import { flightsBetweenPairsSimple } from "../operations/flights-between-pairs";
import longHauler from "./long-hauler";

const api = new FlightRadar24API();
await flightsBetweenPairsSimple(api, longHauler);
