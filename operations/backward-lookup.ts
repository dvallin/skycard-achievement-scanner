import type { FlightRadar24API } from "flightradarapi";
import {
  fetchAllArrivals,
  filterFlightsForToday,
  groupFlightsByOrigin,
  analyzeAllAirports,
  displayFlightsByOrigin,
  displayOptimalBackwardAnalysis,
} from "./shared";

/**
 * Backward lookup: Analyzes arrivals at specified airports to find optimal
 * 30-minute windows with the most unique destination airports by departure origin
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

  // Analyze airports to find optimal 30-minute windows
  const airportResults = analyzeAllAirports(flightsByOrigin);

  // Display the optimal window analysis
  displayOptimalBackwardAnalysis(allFlights, flightsByOrigin, airportResults);
}
