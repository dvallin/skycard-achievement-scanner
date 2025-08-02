import type { FlightRadar24API } from "flightradarapi";
import {
  fetchDepartures,
  filterFlightsForToday,
  filterByDestinations,
  findOptimalForwardWindows,
  displayDepartureSchedule,
  displayOptimalForwardAnalysis,
} from "./shared";

/**
 * Forward lookup: Analyzes departures from a source airport to specified destinations
 * to find optimal 30-minute windows with the most unique destinations
 */
export async function fowardLookup(
  api: FlightRadar24API,
  sourceAirport: string,
  destinationAirports: string[],
  onlyToday = true,
): Promise<void> {
  console.log(`flights from ${sourceAirport}`);

  // Fetch all departure flights from the source airport
  let allFlights = await fetchDepartures(api, sourceAirport);

  // Filter to only include flights to specified destination airports
  allFlights = filterByDestinations(allFlights, destinationAirports);

  // Filter to today's flights if requested
  if (onlyToday) {
    allFlights = filterFlightsForToday(allFlights);
  }

  // Display individual departure flights
  displayDepartureSchedule(allFlights);

  // Find optimal 30-minute windows
  const bestWindows = findOptimalForwardWindows(allFlights);

  // Display the optimal window analysis
  displayOptimalForwardAnalysis(allFlights, bestWindows, sourceAirport);
}
