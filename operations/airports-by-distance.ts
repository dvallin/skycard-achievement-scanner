import type { FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import {
  fetchAllArrivals,
  filterFlightsForToday,
  groupFlightsByOrigin,
  fetchAirportWithCoordinates,
  analyzeAirportsByDistance,
  displayAirportsByDistance,
  displayAirportsDistanceSummary,
} from "./shared";

/**
 * Airports by distance: Analyzes arrivals at specified airports and lists
 * source airports sorted by their distance from an origin airport
 */
export async function airportsByDistance(
  api: FlightRadar24API,
  targetAirports: string[],
  originAirportCode: string,
  onlyToday = true,
): Promise<void> {
  console.log(
    chalk.bold.green(`🔍 Analyzing arrivals at: ${targetAirports.join(", ")}`),
  );
  console.log(chalk.gray(`📍 Origin airport: ${originAirportCode}\n`));

  // Get origin airport details for distance calculation
  const originAirport = await fetchAirportWithCoordinates(
    api,
    originAirportCode,
  );
  if (!originAirport) {
    console.error(
      chalk.red(
        `Failed to get coordinates for origin airport: ${originAirportCode}`,
      ),
    );
    return;
  }

  // Fetch all arrival flights for the specified target airports
  let allFlights = await fetchAllArrivals(api, targetAirports);

  // Filter to today's flights if requested
  if (onlyToday) {
    allFlights = filterFlightsForToday(allFlights);
  }

  console.log(chalk.gray(`📊 Total arrivals found: ${allFlights.length}\n`));

  // Group flights by their origin airport
  const flightsByOrigin = groupFlightsByOrigin(allFlights);

  // Analyze airports by distance
  const airportDistances = analyzeAirportsByDistance(
    flightsByOrigin,
    originAirport,
  );

  if (airportDistances.length === 0) {
    console.log(
      chalk.yellow("No source airports found with valid coordinates."),
    );
    return;
  }

  // Display results
  displayAirportsByDistance(airportDistances, flightsByOrigin);
  displayAirportsDistanceSummary(airportDistances);
}
