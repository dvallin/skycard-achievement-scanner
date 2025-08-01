import type { FlightRadar24API } from "flightradarapi";

export async function airportsOfCountries(
  api: FlightRadar24API,
  countries: string[],
) {
  return (await api.getAirports(countries)).map((a) => a.iata);
}
