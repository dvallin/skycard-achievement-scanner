import type { Flight, FlightRadar24API } from "flightradarapi";
import chalk from "chalk";

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
  time?: {
    scheduled?: { departure?: number; arrival?: number };
    real?: { departure?: number | null; arrival?: number | null };
    estimated?: { departure?: number | null; arrival?: number | null };
  };
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
      )) as { time: SearchFlightEntry["time"] };

      if (details?.time) {
        flight.time = {
          scheduled: details.time.scheduled,
          real: details.time.real,
          estimated: details.time.estimated,
        };

        // Determine status based on time data
        flight.status =
          details.time?.real?.departure != null
            ? details.time.real.arrival != null
              ? "arrived"
              : "departed"
            : "scheduled";
      }

      // Add delay between API calls to avoid rate limiting
      if (i < flights.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(
        chalk.gray(`Failed to get details for ${flight.code}: ${error}`),
      );
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
    .filter((flight) => flight.time) // Only include flights with time data
    .sort((a, b) => {
      const timeA =
        a.time?.real?.departure ??
        a.time?.estimated?.departure ??
        a.time?.scheduled?.departure ??
        0;
      const timeB =
        b.time?.real?.departure ??
        b.time?.estimated?.departure ??
        b.time?.scheduled?.departure ??
        0;
      return timeA - timeB;
    });

  if (sortedFlights.length > 0) {
    console.log(
      chalk.bold.blue(`\n📋 FLIGHTS BY TIME (${sortedFlights.length})`),
    );

    sortedFlights.forEach((flight) => {
      const departureTime =
        flight.time?.real?.departure ??
        flight.time?.estimated?.departure ??
        flight.time?.scheduled?.departure;
      const arrivalTime =
        flight.time?.real?.arrival ??
        flight.time?.estimated?.arrival ??
        flight.time?.scheduled?.arrival;

      const departureStr = departureTime
        ? new Date(departureTime * 1000).toLocaleString()
        : "Unknown";
      const arrivalStr = arrivalTime
        ? new Date(arrivalTime * 1000).toLocaleString()
        : "Unknown";

      const statusIcon =
        flight.status === "arrived"
          ? "🛬"
          : flight.status === "departed"
            ? "🛫"
            : "📅";
      const statusColor =
        flight.status === "arrived"
          ? chalk.green
          : flight.status === "departed"
            ? chalk.yellow
            : chalk.blue;

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
        `  ${statusIcon} ${chalk.cyan(flight.code)} ${chalk.yellow(flight.sourceAirport)} → ${chalk.yellow(flight.destinationAirport)} ${statusColor(flight.status || "scheduled")}`,
      );
      console.log(
        `    ${chalk.gray("Departure:")} ${chalk.white(departureStr)} | ${chalk.gray("Arrival:")} ${chalk.white(arrivalStr)}`,
      );
      console.log(
        `    ${chalk.gray(flight.operator)}${aircraftInfo}${registration}${coordinates}`,
      );
      console.log(""); // Empty line for readability
    });
  }

  // Display flights without time data
  const flightsWithoutTime = flights.filter((flight) => !flight.time);
  if (flightsWithoutTime.length > 0) {
    console.log(
      chalk.yellow(
        `\n⚠️  FLIGHTS WITHOUT TIME DATA (${flightsWithoutTime.length})`,
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
