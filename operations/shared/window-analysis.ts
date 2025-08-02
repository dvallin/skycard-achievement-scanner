import type { BaseFlightEntry, TimeWindow, BackwardFlightEntry, AirportAnalysis } from "./types";
import { WINDOW_SIZE_MS } from "./constants";

/**
 * Generic function to find optimal time windows with most unique destinations
 */
export function findOptimalWindows<T extends BaseFlightEntry>(
  flights: T[],
  getDestinationCode: (flight: T) => string | undefined,
): TimeWindow<T>[] {
  if (flights.length === 0) return [];

  const sortedFlights = flights.slice().sort((a, b) => a.time - b.time);
  let maxUniqueDestinations = 0;
  let bestWindows: TimeWindow<T>[] = [];
  const now = Date.now();

  for (let i = 0; i < sortedFlights.length; i++) {
    const currentFlight = sortedFlights[i];
    if (!currentFlight) continue;

    const windowStart = currentFlight.time;
    // Only consider windows that start no more than 15 minutes in the past
    if (windowStart < now - WINDOW_SIZE_MS / 2) continue;

    const windowEnd = windowStart + WINDOW_SIZE_MS;
    const windowFlights: T[] = [];
    const uniqueDestinations = new Set<string>();

    // Collect flights within the 30-minute window
    for (let j = i; j < sortedFlights.length; j++) {
      const flight = sortedFlights[j];
      if (!flight) continue;

      if (flight.time <= windowEnd) {
        windowFlights.push(flight);
        const destinationCode = getDestinationCode(flight);
        if (destinationCode) {
          uniqueDestinations.add(destinationCode);
        }
      } else {
        break;
      }
    }

    // Update best windows if this one is better or equal
    if (uniqueDestinations.size > maxUniqueDestinations) {
      maxUniqueDestinations = uniqueDestinations.size;
      bestWindows = [
        {
          start: windowStart,
          end: windowEnd,
          destinations: uniqueDestinations,
          flights: windowFlights,
        },
      ];
    } else if (
      uniqueDestinations.size === maxUniqueDestinations &&
      uniqueDestinations.size > 0
    ) {
      bestWindows.push({
        start: windowStart,
        end: windowEnd,
        destinations: uniqueDestinations,
        flights: windowFlights,
      });
    }
  }

  return bestWindows;
}

/**
 * Find optimal windows for forward lookup (departures to destinations)
 */
export function findOptimalForwardWindows<T extends BaseFlightEntry & { destination: { code?: string } }>(
  flights: T[],
): TimeWindow<T>[] {
  return findOptimalWindows(flights, (flight) => flight.destination.code);
}

/**
 * Find optimal windows for backward lookup (arrivals from origins to specific targets)
 */
export function findOptimalBackwardWindows(
  flights: BackwardFlightEntry[],
): TimeWindow<BackwardFlightEntry>[] {
  return findOptimalWindows(flights, (flight) => flight.target);
}

/**
 * Analyze all airports in backward lookup to find best performing ones
 */
export function analyzeAllAirports(
  flightsByOrigin: Record<string, BackwardFlightEntry[]>,
): AirportAnalysis[] {
  const airportResults: AirportAnalysis[] = [];

  for (const [originCode, airportFlights] of Object.entries(flightsByOrigin)) {
    if (airportFlights.length === 0) continue;

    const bestWindows = findOptimalBackwardWindows(airportFlights);

    if (bestWindows.length > 0) {
      const maxDestinations = Math.max(
        ...bestWindows.map((w) => w.destinations.size),
      );

      airportResults.push({
        airportCode: originCode,
        airportName: `${airportFlights[0]?.origin.name}, ${airportFlights[0]?.origin.country}`,
        maxDestinations,
        bestWindows,
      });
    }
  }

  return airportResults.sort((a, b) => b.maxDestinations - a.maxDestinations);
}
