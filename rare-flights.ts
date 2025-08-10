import { FlightRadar24API } from "flightradarapi";
import { flightsByTypes } from "./operations/flights-by-type";

const api = new FlightRadar24API();

const remainingAircrafts = [
  "H269",
  "A5",
  "SONX",
  "PA23",
  "CRER",
  "H53S",
  "PISI",
  "GA6C",
  "EC25",
  "EAGL",
  "BE60",
  "BE99",
  "BE10",
  "C205",
  "C205",
  "V22",
  "COL3",
  "T204",
  "VR7",
];

const sourceAirport = await api.getAirport("HAM");
await flightsByTypes(api, sourceAirport, remainingAircrafts);
