import { Flight, type FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import { formatTime } from "./shared";

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
  arrivalTime?: number;
  status?: "arrived" | "departed" | "scheduled";
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

  // Fetch detailed time information for flights
  await enrichFlightsWithTimeData(api, allFlights);

  // Group and display by original airport pairs
  displayBidirectionalResults(allFlights, airportPairs);
}

/**
 * Enriches flights with detailed time information
 */
async function enrichFlightsWithTimeData(
  api: FlightRadar24API,
  flights: SearchFlightEntry[],
): Promise<void> {
  console.log(chalk.gray("🕐 Fetching detailed time information..."));

  for (let i = 0; i < flights.length; i++) {
    const flight = flights[i]!;
    try {
      const details = (await api.getFlightDetails(
        flight as unknown as Flight,
      )) as { time: any };

      if (details?.time) {
        flight.arrivalTime =
          details.time?.real?.arrival ??
          details.time?.estimated?.arrival ??
          details.time?.scheduled?.arrival;

        // Determine status based on time data
        flight.status =
          details.time?.real?.departure != null
            ? details.time.real.arrival != null
              ? "arrived"
              : "departed"
            : "scheduled";
      }
    } catch (error) {
      // Continue with next flight even if this one fails
    }
  }
}

/**
 * Display search results sorted by time with departure/arrival indication
 */
function displayBidirectionalResults(
  flights: SearchFlightEntry[],
  airportPairs: BidirectionalAirportPair[],
): void {
  console.log(chalk.bold.cyan("✈️  FLIGHT SEARCH RESULTS"));

  // Sort flights by departure time
  const sortedFlights = flights
    .filter((flight) => flight.arrivalTime) // Only include flights with time data
    .sort((a, b) => {
      return (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0);
    });

  if (sortedFlights.length > 0) {
    console.log(
      chalk.bold.blue(`\n📋 Already departed (${sortedFlights.length})`),
    );

    sortedFlights.forEach((flight) => {
      const arrivalStr = formatTime(new Date((flight.arrivalTime ?? 0) * 1000));
      console.log(
        `  ${chalk.cyan(flight.code)} ${chalk.yellow(flight.sourceAirport)} → ${chalk.yellow(flight.destinationAirport)} ${chalk.gray("Arrival:")} ${chalk.white(arrivalStr)}`,
      );
    });
  }

  // Display flights without time data
  const flightsWithoutTime = flights.filter((flight) => !flight.arrivalTime);
  if (flightsWithoutTime.length > 0) {
    console.log(
      chalk.yellow(
        `\nScheduled (or missing data) (${flightsWithoutTime.length})`,
      ),
    );
    flightsWithoutTime.forEach((flight) => {
      const aircraftInfo = flight.aircraft
        ? ` • ${chalk.gray(flight.aircraft)}`
        : "";
      const registration = flight.registration
        ? ` • ${chalk.gray(flight.registration)}`
        : "";

      console.log(
        `  ${chalk.bold.gray("●")} ${chalk.cyan(flight.code)} ${chalk.yellow(flight.sourceAirport)} → ${chalk.yellow(flight.destinationAirport)} ${chalk.gray(flight.operator)}${aircraftInfo}${registration}`,
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
