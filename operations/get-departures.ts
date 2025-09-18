import type { FlightRadar24API } from "flightradarapi";
import type { FlightData } from "../types/flight-data";
import type { Airport } from "../types/airport";
import { DELAY_BETWEEN_CALLS_MS, sleep } from "./shared";

export async function getDepartures(
  api: FlightRadar24API,
  airportCode: string,
): Promise<FlightData[]> {
  let currentPage = 0;
  let total = 0;
  const flights: FlightData[] = [];
  do {
    const result = (await api.getAirportDetails(
      airportCode,
      100,
      currentPage,
    )) as {
      airport: Airport;
    };
    const { page, data } = result.airport.pluginData.schedule.departures;
    total = page.total;
    flights.push(...data.map((a) => a.flight));
    currentPage++;
    if (currentPage <= total) {
      sleep(DELAY_BETWEEN_CALLS_MS);
    }
  } while (currentPage <= total);
  return flights;
}
