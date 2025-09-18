import type { FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import {
  fetchDepartures,
  filterFlightsForToday,
  filterByDestinations,
  formatTime,
  getStatusColor,
  sleep,
} from "./shared";
import type { ForwardFlightEntry } from "./shared";
import { DELAY_BETWEEN_CALLS_MS } from "./shared";

/**
 * Airport pair interface
 */
export interface AirportPair {
  source: string;
  destination: string;
}

/**
 * Route flight entry extending ForwardFlightEntry with route information
 */
export interface RouteFlightEntry extends ForwardFlightEntry {
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

  const allRouteFlights: RouteFlightEntry[] = [];
  let totalFlightsFound = 0;

  // Process each airport pair
  for (const pair of airportPairs) {
    try {
      console.log(
        chalk.gray(
          `Fetching flights from ${pair.source} to ${pair.destination}...`,
        ),
      );

      // Fetch all departure flights from the source airport
      let flights = await fetchDepartures(api, pair.source);

      // Filter to only include flights to the specified destination airport
      flights = filterByDestinations(flights, [pair.destination]);

      // Filter to today's flights if requested
      if (onlyToday) {
        flights = filterFlightsForToday(flights);
      }

      // Transform to RouteFlightEntry with route information
      const routeFlights: RouteFlightEntry[] = flights.map((flight) => ({
        ...flight,
        sourceAirport: pair.source,
        destinationAirport: pair.destination,
      }));

      allRouteFlights.push(...routeFlights);
      totalFlightsFound += routeFlights.length;

      console.log(
        chalk.gray(
          `  Found ${routeFlights.length} flight${routeFlights.length === 1 ? "" : "s"} on this route`,
        ),
      );

      // Add delay between API calls to avoid rate limiting
      if (airportPairs.indexOf(pair) < airportPairs.length - 1) {
        await sleep(DELAY_BETWEEN_CALLS_MS);
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Failed to fetch flights from ${pair.source} to ${pair.destination}: ${error}`,
        ),
      );
    }
  }

  console.log(
    chalk.gray(
      `\n📊 Total flights found: ${totalFlightsFound}${onlyToday ? " today" : ""}\n`,
    ),
  );

  if (allRouteFlights.length === 0) {
    console.log(
      chalk.yellow(
        `No flights found for any of the specified routes${onlyToday ? " today" : ""}`,
      ),
    );
    return;
  }

  // Sort all flights by departure time
  const sortedFlights = allRouteFlights.sort((a, b) => a.time - b.time);

  // Display flights grouped by route
  displayFlightsByRoute(sortedFlights);

  // Display overall summary
  displayOverallSummary(sortedFlights, airportPairs);
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
