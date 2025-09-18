import type { BackwardFlightEntry } from "./types";
/**
 * Analyze airports by diversity (number of distinct destinations) instead of time windows
 */
export function analyzeAirportsByDiversity(
  flightsByOrigin: Record<string, BackwardFlightEntry[]>,
): import("./types").AirportDiversity[] {
  const airportResults: import("./types").AirportDiversity[] = [];
  const now = Date.now();

  for (const [originCode, airportFlights] of Object.entries(flightsByOrigin)) {
    if (airportFlights.length === 0 || !originCode || originCode === "UNKNOWN")
      continue;

    // Get all unique destinations for this origin airport
    const destinations = new Set<string>();
    airportFlights.forEach((flight) => {
      if (flight.target) {
        destinations.add(flight.target);
      }
    });

    // Find the next flight from now
    const futureFlights = airportFlights
      .filter((flight) => flight.time >= now)
      .sort((a, b) => a.time - b.time);

    const nextFlightTime =
      futureFlights.length > 0 ? futureFlights[0]!.time : Infinity;

    const firstFlight = airportFlights[0];
    if (firstFlight) {
      airportResults.push({
        code: originCode,
        name: firstFlight.origin.name || "Unknown",
        country: firstFlight.origin.country || "Unknown",
        distinctDestinations: destinations.size,
        totalFlights: airportFlights.length,
        nextFlightTime,
        destinations,
      });
    }
  }

  // Sort by distinct destinations (descending), then by next flight time (ascending)
  return airportResults.sort((a, b) => {
    if (b.distinctDestinations !== a.distinctDestinations) {
      return b.distinctDestinations - a.distinctDestinations;
    }
    return a.nextFlightTime - b.nextFlightTime;
  });
}

/**
 * Analyze departures by diversity (number of distinct destinations) for forward lookup
 */
export function analyzeDeparturesByDiversity(
  flights: import("./types").ForwardFlightEntry[],
  sourceAirport: string,
): {
  sourceCode: string;
  distinctDestinations: number;
  totalFlights: number;
  nextFlightTime: number;
  destinations: Set<string>;
} | null {
  if (flights.length === 0) return null;

  const now = Date.now();

  // Get all unique destinations
  const destinations = new Set<string>();
  flights.forEach((flight) => {
    if (flight.destination.code) {
      destinations.add(flight.destination.code);
    }
  });

  // Find the next flight from now
  const futureFlights = flights
    .filter((flight) => flight.time >= now)
    .sort((a, b) => a.time - b.time);

  const nextFlightTime =
    futureFlights.length > 0 ? futureFlights[0]!.time : Infinity;

  return {
    sourceCode: sourceAirport,
    distinctDestinations: destinations.size,
    totalFlights: flights.length,
    nextFlightTime,
    destinations,
  };
}
