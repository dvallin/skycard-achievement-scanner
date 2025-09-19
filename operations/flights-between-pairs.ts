import type { FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import {
  fetchDeparturesWithRetry,
  fetchArrivalsWithRetry,
  filterFlightsForToday,
  filterByDestinations,
  groupFlightsByOrigin,
  formatTime,
  getStatusColor,
  sleep,
} from "./shared";
import type { ForwardFlightEntry, BackwardFlightEntry } from "./shared";
import { DELAY_BETWEEN_CALLS_MS } from "./shared";

/**
 * Rate limiting improvements to avoid 429 errors:
 * - Uses retry logic for both departures and arrivals
 * - Implements adaptive delays that increase after rate limit hits
 * - Adds exponential backoff in retry attempts
 * - Spaces out API calls between airports and between departures/arrivals
 */

// Adaptive rate limiting state
let currentDelayMs = DELAY_BETWEEN_CALLS_MS;
let lastRateLimitTime = 0;
const RATE_LIMIT_COOLDOWN_MS = 30000; // 30 seconds

function getAdaptiveDelay(): number {
  const timeSinceLastRateLimit = Date.now() - lastRateLimitTime;

  // If we hit a rate limit recently, use longer delays
  if (timeSinceLastRateLimit < RATE_LIMIT_COOLDOWN_MS) {
    currentDelayMs = Math.min(currentDelayMs * 1.5, 10000); // Cap at 10 seconds
  } else {
    // Gradually reduce delay if no recent rate limits
    currentDelayMs = Math.max(currentDelayMs * 0.9, DELAY_BETWEEN_CALLS_MS);
  }

  return currentDelayMs;
}

function recordRateLimit(): void {
  lastRateLimitTime = Date.now();
  currentDelayMs = Math.min(currentDelayMs * 2, 10000); // Double the delay, cap at 10s
}

/**
 * Airport pair interface
 */
export interface AirportPair {
  source: string;
  destination: string;
}

export interface RouteFlightEntry {
  status: string;
  code: string;
  time: number;
  sourceAirport: string;
  destinationAirport: string;
}

/**
 * Flights between pairs: Lists flights between multiple airport pairs
 * sorted by departure time
 */
export async function flightsBetweenPairs(
  api: FlightRadar24API,
  airportPairs: AirportPair[],
  onlyToday = true,
): Promise<void> {
  console.log(
    chalk.bold.green(
      `✈️  Flights between ${airportPairs.length} airport pair${airportPairs.length === 1 ? "" : "s"}`,
    ),
  );

  // Display the pairs being searched
  console.log(chalk.gray("\n🔍 Searching routes:"));
  airportPairs.forEach((pair, index) => {
    console.log(
      chalk.gray(
        `  ${index + 1}. ${chalk.yellow(pair.source)} → ${chalk.yellow(pair.destination)}`,
      ),
    );
  });
  console.log("");

  const routes: RouteFlightEntry[] = [];

  // Collect unique source airports and group pairs by source
  const sourceGroups = new Map<string, AirportPair[]>();
  airportPairs.forEach((pair) => {
    if (!sourceGroups.has(pair.source)) {
      sourceGroups.set(pair.source, []);
    }
    sourceGroups.get(pair.source)!.push(pair);
  });

  const uniqueSources = Array.from(sourceGroups.keys());

  // Prefetch departures for each unique source airport
  const departuresBySource = new Map<string, ForwardFlightEntry[]>();
  const arrivalsBySource = new Map<string, BackwardFlightEntry[]>();

  for (const source of uniqueSources) {
    try {
      let departures = await fetchDeparturesWithRetry(api, source);
      // Filter to today's flights if requested (do this once per source)
      if (onlyToday) {
        departures = filterFlightsForToday(departures);
      }
      departuresBySource.set(source, departures);

      console.log(
        chalk.gray(
          `  Fetched ${departures.length} departure${departures.length === 1 ? "" : "s"} from ${source}`,
        ),
      );
    } catch (error) {
      if (String(error).includes("429")) {
        recordRateLimit();
      }
      console.error(
        chalk.red(`Failed to fetch flights from ${source}: ${error}`),
      );
      departuresBySource.set(source, []); // Set empty array to prevent errors
    }

    // Add adaptive delay between departures and arrivals calls
    const adaptiveDelay = getAdaptiveDelay();
    console.log(
      chalk.gray(`  Waiting ${adaptiveDelay}ms before next API call...`),
    );
    await sleep(adaptiveDelay);

    try {
      let arrivals = await fetchArrivalsWithRetry(api, source);
      // Filter to today's flights if requested (do this once per source)
      if (onlyToday) {
        arrivals = filterFlightsForToday(arrivals);
      }
      arrivalsBySource.set(source, arrivals);

      console.log(
        chalk.gray(
          `  Fetched ${arrivals.length} arrival${arrivals.length === 1 ? "" : "s"} from ${source}`,
        ),
      );
    } catch (error) {
      if (String(error).includes("429")) {
        recordRateLimit();
      }
      console.error(
        chalk.red(`Failed to fetch flights from ${source}: ${error}`),
      );
      arrivalsBySource.set(source, []); // Set empty array to prevent errors
    }

    // Add adaptive delay between processing different airports
    if (source !== uniqueSources[uniqueSources.length - 1]) {
      const finalDelay = getAdaptiveDelay();
      console.log(
        chalk.gray(`  Waiting ${finalDelay}ms before next airport...`),
      );
      await sleep(finalDelay);
    }
  }

  // Process each airport pair using prefetched data
  for (const pair of airportPairs) {
    try {
      console.log(
        chalk.gray(`Processing route ${pair.source} → ${pair.destination}...`),
      );

      const departures = departuresBySource.get(pair.source) || [];
      const arrivals = arrivalsBySource.get(pair.source) || [];

      // Filter to only include flights to the specified destination airport
      const relevantDepartures = filterByDestinations(departures, [
        pair.destination,
      ]);

      // Transform to RouteFlightEntry with route information
      const outgoingRoutes: RouteFlightEntry[] = relevantDepartures.map(
        (flight) => ({
          ...flight,
          sourceAirport: pair.source,
          destinationAirport: pair.destination,
        }),
      );

      const relevantArrivals = arrivals.filter(
        (a) => a.origin === pair.destination,
      );

      // Transform to BackwardRouteFlightEntry with route information
      const incomingRoutes: RouteFlightEntry[] = relevantArrivals.map(
        (flight) => ({
          ...flight,
          sourceAirport: pair.source,
          destinationAirport: pair.destination,
        }),
      );

      routes.push(...incomingRoutes, ...outgoingRoutes);

      const totalFound = incomingRoutes.length + outgoingRoutes.length;
      console.log(
        chalk.gray(
          `  Found ${totalFound} arrival flight${totalFound === 1 ? "" : "s"} on this route`,
        ),
      );
    } catch (error) {
      console.error(
        chalk.red(
          `Failed to process route ${pair.source} to ${pair.destination}: ${error}`,
        ),
      );
    }
  }

  console.log(
    chalk.gray(
      `\n📊 Total flights found: ${routes.length}${onlyToday ? " today" : ""}\n`,
    ),
  );

  if (routes.length === 0) {
    console.log(
      chalk.yellow(
        `No flights found for any of the specified routes${onlyToday ? " today" : ""}`,
      ),
    );
    return;
  }

  // Combine and sort all flights by departure time
  const sortedRoutes = routes.sort((a, b) => a.time - b.time);

  // Display flights grouped by route
  displayFlightsByRoute(sortedRoutes);

  // Display overall summary
  displayOverallSummary(sortedRoutes, airportPairs);
}

/**
 * Display flights grouped by route
 */
function displayFlightsByRoute(flights: RouteFlightEntry[]): void {
  console.log(chalk.bold.cyan("📋 FLIGHTS BY ROUTE"));

  // Group flights by route
  const flightsByRoute: Record<string, RouteFlightEntry[]> = {};

  flights.forEach((flight) => {
    const routeKey = `${flight.sourceAirport}-${flight.destinationAirport}`;
    if (!flightsByRoute[routeKey]) {
      flightsByRoute[routeKey] = [];
    }
    flightsByRoute[routeKey].push(flight);
  });

  // Display each route
  Object.entries(flightsByRoute).forEach(([routeKey, routeFlights]) => {
    const [source, destination] = routeKey.split("-");
    console.log(
      chalk.bold(
        `\n${chalk.yellow(source)} → ${chalk.yellow(destination)} (${routeFlights.length} flight${routeFlights.length === 1 ? "" : "s"})`,
      ),
    );

    routeFlights.forEach((flight, index) => {
      const date = new Date(flight.time);
      const statusColor = getStatusColor(flight.status);

      console.log(
        `  ${chalk.gray(formatTime(date))} - ${chalk.cyan(flight.code)} ${statusColor(flight.status)}`,
      );
    });
  });
}

/**
 * Display overall summary for all routes
 */
function displayOverallSummary(
  flights: RouteFlightEntry[],
  airportPairs: AirportPair[],
): void {
  if (flights.length === 0) return;

  const now = Date.now();
  const futureFlights = flights.filter((flight) => flight.time >= now);
  const pastFlights = flights.filter((flight) => flight.time < now);

  console.log(chalk.bold.cyan(`\n📈 OVERALL SUMMARY`));
  console.log(chalk.gray(`Routes searched: ${airportPairs.length}`));
  console.log(chalk.gray(`Total flights: ${flights.length}`));

  if (futureFlights.length > 0) {
    console.log(chalk.green(`Upcoming flights: ${futureFlights.length}`));

    // Show next flight across all routes
    const nextFlight = futureFlights[0];
    if (nextFlight) {
      const nextDate = new Date(nextFlight.time);
      const timeUntil = nextFlight.time - now;
      const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
      const minutesUntil = Math.floor(
        (timeUntil % (1000 * 60 * 60)) / (1000 * 60),
      );

      console.log(
        chalk.green(
          `Next departure: ${formatTime(nextDate)} - ${chalk.cyan(nextFlight.code)} (${chalk.yellow(nextFlight.sourceAirport)} → ${chalk.yellow(nextFlight.destinationAirport)}) - ${hoursUntil}h ${minutesUntil}m`,
        ),
      );
    }

    // Show route distribution for upcoming flights
    const routeDistribution: Record<string, number> = {};
    futureFlights.forEach((flight) => {
      const routeKey = `${flight.sourceAirport}-${flight.destinationAirport}`;
      routeDistribution[routeKey] = (routeDistribution[routeKey] || 0) + 1;
    });

    console.log(chalk.gray("\nUpcoming flights by route:"));
    Object.entries(routeDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([route, count]) => {
        const [source, destination] = route.split("-");
        console.log(
          chalk.gray(
            `  ${chalk.yellow(source)} → ${chalk.yellow(destination)}: ${count} flight${count === 1 ? "" : "s"}`,
          ),
        );
      });
  } else {
    console.log(chalk.yellow("No upcoming flights"));
  }

  if (pastFlights.length > 0) {
    console.log(chalk.gray(`Past flights: ${pastFlights.length}`));
  }

  // Show routes with no flights
  const routesWithFlights = new Set(
    flights.map((f) => `${f.sourceAirport}-${f.destinationAirport}`),
  );
  const routesWithoutFlights = airportPairs.filter(
    (pair) => !routesWithFlights.has(`${pair.source}-${pair.destination}`),
  );

  if (routesWithoutFlights.length > 0) {
    console.log(chalk.yellow(`\nRoutes with no flights:`));
    routesWithoutFlights.forEach((pair) => {
      console.log(
        chalk.yellow(
          `  ${chalk.gray(pair.source)} → ${chalk.gray(pair.destination)}`,
        ),
      );
    });
  }
}
