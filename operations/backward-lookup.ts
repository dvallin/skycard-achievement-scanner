import type { FlightRadar24API } from "flightradarapi";
import {
  fetchAllArrivals,
  filterFlightsForToday,
  groupFlightsByOrigin,
  analyzeAirportsByDiversity,
  displayFlightsByOrigin,
  displayAirportsByDiversity,
  displayDiversitySummary,
} from "./shared";

/**
 * Backward lookup: Analyzes arrivals at specified airports and displays
 * origin airports sorted by their destination diversity and next flight time
 */
export async function backwardLookup(
  api: FlightRadar24API,
  currentAirports: string[],
  onlyToday = true,
): Promise<void> {
  // Fetch all arrival flights for the specified airports
  let allFlights = await fetchAllArrivals(api, currentAirports);

  // Filter to today's flights if requested
  if (onlyToday) {
    allFlights = filterFlightsForToday(allFlights);
  }

  // Group flights by their origin airport
  const flightsByOrigin = groupFlightsByOrigin(allFlights);

  // Display flights grouped by origin
  displayFlightsByOrigin(flightsByOrigin);

  // Analyze airports by destination diversity
  const airportResults = analyzeAirportsByDiversity(flightsByOrigin);

  // Display the diversity analysis
  displayAirportsByDiversity(airportResults, flightsByOrigin);
  displayDiversitySummary(airportResults);
}
