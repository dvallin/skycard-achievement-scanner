import type { FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import { sleep } from "./shared";

/**
 * Simple airport pair interface
 */
export interface AirportPair {
  source: string;
  destination: string;
}

/**
 * Enhanced airport pair with bidirectional search
 */
export interface BidirectionalAirportPair {
  source: string;
  destination: string;
  searchBothDirections?: boolean;
}

/**
 * Simplified flight entry from search API
 */
export interface SearchFlightEntry {
  id: string;
  code: string;
  operator: string;
  operatorName?: string;
  logo?: string;
  route: string;
  type: "live" | "schedule";
  aircraft?: string;
  registration?: string;
  sourceAirport: string;
  destinationAirport: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Search API response types
 */
interface SearchResultFlight {
  id: string;
  label: string;
  detail: {
    lat?: number;
    lon?: number;
    schd_from?: string;
    schd_to?: string;
    ac_type?: string;
    route?: string;
    logo?: string;
    reg?: string;
    callsign?: string;
    flight?: string;
    operator?: string;
    operator_id?: number;
  };
  type: string;
  match: string;
}

interface SearchResult {
  airport?: any[];
  operator?: any[];
  live?: SearchResultFlight[];
  schedule?: SearchResultFlight[];
  aircraft?: any[];
}

/**
 * Search flights in both directions for each airport pair
 */
export async function flightsBetweenPairsSimple(
  api: FlightRadar24API,
  airportPairs: BidirectionalAirportPair[],
): Promise<void> {
  console.log(
    chalk.bold.green(
      `✈️  Searching flights between ${airportPairs.length} airport pair${airportPairs.length === 1 ? "" : "s"}`,
    ),
  );

  const allPairsToSearch: AirportPair[] = [];

  // Generate all pairs to search (including reverse directions)
  airportPairs.forEach((pair) => {
    // Add the original direction
    allPairsToSearch.push({
      source: pair.source,
      destination: pair.destination,
    });

    // Add reverse direction if requested (default: true)
    if (pair.searchBothDirections !== false) {
      allPairsToSearch.push({
        source: pair.destination,
        destination: pair.source,
      });
    }
  });

  console.log(chalk.gray("\n🔍 Routes to search:"));
  allPairsToSearch.forEach((pair, index) => {
    console.log(
      chalk.gray(
        `  ${index + 1}. ${chalk.yellow(pair.source)} → ${chalk.yellow(pair.destination)}`,
      ),
    );
  });
  console.log("");

  const allFlights: SearchFlightEntry[] = [];

  // Search each route
  for (const pair of allPairsToSearch) {
    try {
      const query = `${pair.source}-${pair.destination}`;

      const searchResult: SearchResult = await api.search(query);

      // Extract live flights
      const liveFlights: SearchFlightEntry[] = (searchResult.live || [])
        .filter(
          (flight) =>
            flight.detail.schd_from === pair.source &&
            flight.detail.schd_to === pair.destination,
        )
        .map((flight: SearchResultFlight) => ({
          id: flight.id,
          code:
            flight.detail.flight || flight.label.split(" / ")[0] || flight.id,
          operator: flight.detail.operator || "Unknown",
          operatorName: flight.detail.operator || "Unknown",
          logo: flight.detail.logo,
          route: flight.detail.route || `${pair.source} → ${pair.destination}`,
          type: "live" as const,
          aircraft: flight.detail.ac_type,
          registration: flight.detail.reg,
          sourceAirport: pair.source,
          destinationAirport: pair.destination,
          coordinates:
            flight.detail.lat && flight.detail.lon
              ? {
                  latitude: flight.detail.lat,
                  longitude: flight.detail.lon,
                }
              : undefined,
        }));

      // Extract scheduled flights
      const scheduledFlights: SearchFlightEntry[] = (
        searchResult.schedule || []
      )
        .filter(
          (flight) =>
            flight.detail.schd_from === pair.source &&
            flight.detail.schd_to === pair.destination,
        )
        .map((flight: SearchResultFlight) => ({
          id: flight.id,
          code:
            flight.detail.flight || flight.label.split(" / ")[0] || flight.id,
          operator: flight.detail.operator || "Unknown",
          operatorName: flight.detail.operator || "Unknown",
          logo: flight.detail.logo,
          route: `${pair.source} → ${pair.destination}`,
          type: "schedule" as const,
          sourceAirport: pair.source,
          destinationAirport: pair.destination,
        }));

      const routeFlights = [...liveFlights, ...scheduledFlights];
      allFlights.push(...routeFlights);
    } catch (error) {
      console.error(
        chalk.red(
          `Failed to search route ${pair.source}-${pair.destination}: ${error}`,
        ),
      );
    }
  }

  console.log(chalk.gray(`\n📊 Total flights found: ${allFlights.length}\n`));

  if (allFlights.length === 0) {
    console.log(
      chalk.yellow("No flights found for any of the specified routes"),
    );
    return;
  }

  // Group and display by original airport pairs
  displayBidirectionalResults(allFlights, airportPairs);
}

/**
 * Display search results grouped by live/scheduled status
 */
function displayBidirectionalResults(
  flights: SearchFlightEntry[],
  airportPairs: BidirectionalAirportPair[],
): void {
  console.log(chalk.bold.cyan("✈️  FLIGHT SEARCH RESULTS"));

  const liveFlights = flights.filter((f) => f.type === "live");
  const scheduledFlights = flights.filter((f) => f.type === "schedule");

  // Display live flights
  if (liveFlights.length > 0) {
    console.log(chalk.bold.green(`\n🔴 LIVE FLIGHTS (${liveFlights.length})`));
    liveFlights.forEach((flight) => {
      const aircraftInfo = flight.aircraft
        ? ` • ${chalk.gray(flight.aircraft)}`
        : "";
      const registration = flight.registration
        ? ` • ${chalk.gray(flight.registration)}`
        : "";
      const coordinates = flight.coordinates
        ? ` • ${chalk.gray(`${flight.coordinates.latitude.toFixed(1)}, ${flight.coordinates.longitude.toFixed(1)}`)}`
        : "";

      console.log(
        `  ${chalk.bold.green("●")} ${chalk.cyan(flight.code)} ${chalk.yellow(flight.sourceAirport)} → ${chalk.yellow(flight.destinationAirport)} ${chalk.gray(flight.operator)}${aircraftInfo}${registration}${coordinates}`,
      );
    });
  }

  // Display scheduled flights
  if (scheduledFlights.length > 0) {
    console.log(
      chalk.bold.blue(`\n📅 SCHEDULED FLIGHTS (${scheduledFlights.length})`),
    );
    scheduledFlights.forEach((flight) => {
      console.log(
        `  ${chalk.bold.blue("●")} ${chalk.cyan(flight.code)} ${chalk.yellow(flight.sourceAirport)} → ${chalk.yellow(flight.destinationAirport)} ${chalk.gray(flight.operator)}`,
      );
    });
  }

  // Display routes with no flights
  const routesWithFlights = new Set(
    flights.map((f) => `${f.sourceAirport}-${f.destinationAirport}`),
  );

  const allSearchedRoutes: string[] = [];
  airportPairs.forEach((pair) => {
    allSearchedRoutes.push(`${pair.source}-${pair.destination}`);
    if (pair.searchBothDirections !== false) {
      allSearchedRoutes.push(`${pair.destination}-${pair.source}`);
    }
  });

  const routesWithoutFlights = allSearchedRoutes.filter(
    (route) => !routesWithFlights.has(route),
  );

  if (routesWithoutFlights.length > 0) {
    console.log(
      chalk.yellow(
        `\n❌ ROUTES WITH NO FLIGHTS (${routesWithoutFlights.length})`,
      ),
    );
    routesWithoutFlights.forEach((route) => {
      const [source, destination] = route.split("-");
      console.log(chalk.gray(`  ${source} → ${destination}`));
    });
  }
}
