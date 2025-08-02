import type { Entity, FlightRadar24API } from "flightradarapi";
import pLimit from "p-limit";
import {
  fetchFlightsByType,
  displayAircraftFlights,
  displayMissingAircraftTypes,
} from "./shared";

const limit = pLimit(5);

/**
 * Flights by types: Fetches and displays flights of specified aircraft types
 * sorted by distance from a given entity/location
 */
export async function flightsByTypes(
  api: FlightRadar24API,
  entity: Entity,
  aircraftTypes: string[],
): Promise<void> {
  // Fetch flights for all aircraft types concurrently with rate limiting
  const requests = aircraftTypes.map((aircraftType) =>
    limit(() => fetchFlightsByType(api, entity, aircraftType)),
  );

  const allResults = await Promise.all(requests);
  const results = allResults.flatMap((flights) => flights);

  // Display all flights sorted by distance
  displayAircraftFlights(results);

  // Check for missing aircraft types and display summary
  const foundTypes = new Set(results.map((flight) => flight.code));
  displayMissingAircraftTypes(aircraftTypes, foundTypes);
}
