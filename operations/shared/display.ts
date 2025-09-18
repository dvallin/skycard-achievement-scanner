import chalk from "chalk";
import type {
  BaseFlightEntry,
  TimeWindow,
  AirportAnalysis,
  ForwardFlightEntry,
  BackwardFlightEntry,
  AircraftFlightEntry,
  AirportDistance,
} from "./types";
import { formatTime, getStatusColor } from "./utils";
import {
  FLIGHTS_TO_DISPLAY,
  WINDOWS_TO_DISPLAY,
  AIRPORTS_TO_DISPLAY,
  TOP_AIRPORTS_TO_DISPLAY,
} from "./constants";
import { country_reverse_geocoding } from "country-reverse-geocoding";
const crg = country_reverse_geocoding();

/**
 * Check if a timestamp falls within the undesirable time range (23:00-06:00)
 */
function isInUndesirableTimeRange(timestamp: number): boolean {
  const date = new Date(timestamp);
  const hour = date.getHours();
  return hour >= 23 || hour < 6;
}

/**
 * Calculate a penalty score for window sorting based on time preferences
 */
function getWindowTimePenalty(windowStart: number, windowEnd: number): number {
  const midpoint = (windowStart + windowEnd) / 2;
  return isInUndesirableTimeRange(midpoint) ? 1000000 : 0; // Large penalty for undesirable hours
}

/**
 * Display flights within a time window
 */
export function displayWindowFlights<T extends BaseFlightEntry>(
  window: TimeWindow<T>,
  getDisplayInfo: (flight: T) => {
    destination: string;
    destinationCode?: string;
  },
): void {
  console.log(chalk.gray("   ✈️  Flights:"));

  const flightsToShow = window.flights
    .sort((a, b) => a.time - b.time)
    .slice(0, FLIGHTS_TO_DISPLAY);

  flightsToShow.forEach((flight) => {
    const flightDate = new Date(flight.time);
    const statusColor = getStatusColor(flight.status);
    const { destination, destinationCode } = getDisplayInfo(flight);

    const destinationDisplay = destinationCode
      ? `${chalk.bold(destination)} (${chalk.gray(destinationCode)})`
      : chalk.bold(destination);

    console.log(
      `      ${chalk.gray(formatTime(flightDate))} - ${chalk.cyan(flight.code)} → ${destinationDisplay} ${statusColor(flight.status)}`,
    );
  });

  if (window.flights.length > FLIGHTS_TO_DISPLAY) {
    console.log(
      chalk.gray(
        `      ... and ${window.flights.length - FLIGHTS_TO_DISPLAY} more flights`,
      ),
    );
  }
}

/**
 * Display forward lookup flight window (departures)
 */
export function displayForwardWindowFlights(
  window: TimeWindow<ForwardFlightEntry>,
): void {
  displayWindowFlights(window, (flight) => ({
    destination: flight.destination.name || "Unknown",
    destinationCode: flight.destination.code,
  }));
}

/**
 * Display backward lookup flight window (arrivals)
 */
export function displayBackwardWindowFlights(
  window: TimeWindow<BackwardFlightEntry>,
): void {
  displayWindowFlights(window, (flight) => ({
    destination: flight.target,
  }));
}

/**
 * Display flights grouped by origin airport (backward lookup)
 */
export function displayFlightsByOrigin(
  flightsByOrigin: Record<string, BackwardFlightEntry[]>,
): void {
  Object.entries(flightsByOrigin).forEach(([originCode, flights]) => {
    console.log(
      chalk.bold(
        `\n${originCode} (${flights[0]?.origin.name}, ${flights[0]?.origin.country})`,
      ),
    );

    flights
      .sort((a, b) => a.time - b.time)
      .forEach((flight) => {
        const date = new Date(flight.time);
        const statusColor = getStatusColor(flight.status);

        console.log(
          `${chalk.gray(formatTime(date))} - ${chalk.cyan(flight.code)} ${flight.target} ${statusColor(flight.status)}`,
        );
      });
  });
}

/**
 * Display individual departure flights (forward lookup)
 */
export function displayDepartureSchedule(flights: ForwardFlightEntry[]): void {
  console.log(chalk.bold.cyan("\n📋 DEPARTURE SCHEDULE"));

  flights
    .sort((a, b) => a.time - b.time)
    .forEach((flight) => {
      const date = new Date(flight.time);
      const statusColor = getStatusColor(flight.status);

      console.log(
        `${chalk.gray(formatTime(date))} - ${chalk.cyan(flight.code)} ${chalk.magenta(flight.destination.name)} (${chalk.gray(flight.destination?.country?.name)}) ${statusColor(flight.status)}`,
      );
    });
}

/**
 * Display analysis for a single airport (backward lookup)
 */
export function displayAirportAnalysis(airport: AirportAnalysis): void {
  console.log(
    chalk.bold.yellow(`🏆 ${airport.airportCode} (${airport.airportName})`),
  );
  console.log(chalk.green(`   Max destinations: ${airport.maxDestinations}`));
  console.log(
    chalk.gray(`   Found ${airport.bestWindows.length} optimal window(s):`),
  );

  const now = Date.now();
  const windowsToShow = airport.bestWindows
    .slice()
    .sort((a, b) => {
      const aMid = (a.start + a.end) / 2;
      const bMid = (b.start + b.end) / 2;

      // Apply time preference penalty
      const aPenalty = getWindowTimePenalty(a.start, a.end);
      const bPenalty = getWindowTimePenalty(b.start, b.end);
      const penaltyDiff = aPenalty - bPenalty;

      if (penaltyDiff !== 0) {
        return penaltyDiff;
      }

      // If penalties are equal, sort by distance to current time
      return Math.abs(aMid - now) - Math.abs(bMid - now);
    })
    .slice(0, WINDOWS_TO_DISPLAY);

  windowsToShow.forEach((window, windowIndex) => {
    const startDate = new Date(window.start);
    const endDate = new Date(window.end);

    console.log(
      chalk.cyan(
        `   📅 Window ${windowIndex + 1}: ${formatTime(startDate)} → ${formatTime(endDate)}`,
      ),
    );
    console.log(
      chalk.white(
        `   🎯 Destinations: ${Array.from(window.destinations).sort().join(", ")}`,
      ),
    );

    displayBackwardWindowFlights(window);
    console.log("");
  });

  if (airport.bestWindows.length > WINDOWS_TO_DISPLAY) {
    console.log(
      chalk.gray(
        `   ... and ${airport.bestWindows.length - WINDOWS_TO_DISPLAY} more optimal windows\n`,
      ),
    );
  } else {
    console.log("");
  }
}

/**
 * Display optimal window analysis for backward lookup
 */
export function displayOptimalBackwardAnalysis(
  flights: BackwardFlightEntry[],
  flightsByOrigin: Record<string, BackwardFlightEntry[]>,
  airportResults: AirportAnalysis[],
): void {
  console.log(chalk.bold.magenta("\n🔍 OPTIMAL 30-MINUTE WINDOW ANALYSIS"));
  console.log(
    chalk.gray(
      "Finding windows with most unique destination airports by departure airport...\n",
    ),
  );

  if (flights.length === 0) {
    console.log(chalk.yellow("No flights to analyze."));
    return;
  }

  if (airportResults.length === 0) {
    console.log(chalk.yellow("No airports with flights found."));
    return;
  }

  const globalMaxDestinations = Math.max(
    ...airportResults.map((a) => a.maxDestinations),
  );

  console.log(
    chalk.bold.green(
      `✨ Best 30-minute window globally: ${globalMaxDestinations} unique destinations`,
    ),
  );
  console.log(
    chalk.gray(
      `Analyzed ${Object.keys(flightsByOrigin).length} departure airports\n`,
    ),
  );

  // Display top airports
  const airportsToShow = airportResults.slice(0, AIRPORTS_TO_DISPLAY);
  airportsToShow.forEach(displayAirportAnalysis);

  if (airportResults.length > AIRPORTS_TO_DISPLAY) {
    console.log(
      chalk.gray(
        `... and ${airportResults.length - AIRPORTS_TO_DISPLAY} more airports with optimal windows`,
      ),
    );
  }
}

/**
 * Display optimal window analysis for forward lookup
 */
export function displayOptimalForwardAnalysis<T extends ForwardFlightEntry>(
  flights: T[],
  bestWindows: TimeWindow<T>[],
  sourceAirport: string,
): void {
  console.log(
    chalk.bold.magenta("\n🔍 OPTIMAL 30-MINUTE DEPARTURE WINDOW ANALYSIS"),
  );
  console.log(
    chalk.gray(
      `Finding windows with most unique destinations from ${sourceAirport}...\n`,
    ),
  );

  if (flights.length === 0) {
    console.log(chalk.yellow("No flights to analyze."));
    return;
  }

  if (bestWindows.length === 0) {
    console.log(chalk.yellow("No optimal windows found."));
    return;
  }

  const maxDestinations = Math.max(
    ...bestWindows.map((w) => w.destinations.size),
  );

  console.log(
    chalk.bold.green(
      `✨ Best 30-minute departure window: ${maxDestinations} unique destinations`,
    ),
  );
  console.log(
    chalk.gray(
      `Found ${bestWindows.length} optimal window(s) from ${sourceAirport}\n`,
    ),
  );

  const now = Date.now();
  const windowsToShow = bestWindows
    .slice()
    .sort((a, b) => {
      const aMid = (a.start + a.end) / 2;
      const bMid = (b.start + b.end) / 2;

      // Apply time preference penalty
      const aPenalty = getWindowTimePenalty(a.start, a.end);
      const bPenalty = getWindowTimePenalty(b.start, b.end);
      const penaltyDiff = aPenalty - bPenalty;

      if (penaltyDiff !== 0) {
        return penaltyDiff;
      }

      // If penalties are equal, sort by distance to current time
      return Math.abs(aMid - now) - Math.abs(bMid - now);
    })
    .slice(0, WINDOWS_TO_DISPLAY);

  windowsToShow.forEach((window, windowIndex) => {
    const startDate = new Date(window.start);
    const endDate = new Date(window.end);

    console.log(chalk.bold.yellow(`🏆 Optimal Window ${windowIndex + 1}`));
    console.log(
      chalk.cyan(
        `   📅 Time: ${formatTime(startDate)} → ${formatTime(endDate)}`,
      ),
    );
    console.log(
      chalk.green(`   🎯 Unique destinations: ${window.destinations.size}`),
    );
    console.log(
      chalk.white(
        `   🗺️  Destinations: ${Array.from(window.destinations).sort().join(", ")}`,
      ),
    );

    displayForwardWindowFlights(window);
    console.log("");
  });

  if (bestWindows.length > WINDOWS_TO_DISPLAY) {
    console.log(
      chalk.gray(
        `   ... and ${bestWindows.length - WINDOWS_TO_DISPLAY} more optimal windows\n`,
      ),
    );
  }
}

/**
 * Display individual aircraft flight
 */
export function displayAircraftFlight(flight: AircraftFlightEntry): void {
  const aircraftStr = chalk.cyan.bold(flight.code);
  const registrationStr = chalk.yellow(flight.registration);
  const distStr = chalk.magenta(
    `${flight.closestAirport.distance.toFixed()}km (${flight.closestAirport.code})`,
  );
  const coordStr = chalk.gray(
    `[${flight.coordinates.map((c) => c?.toFixed(3)).join(", ")}]`,
  );
  const [lat, lon] = flight.coordinates;
  let locationStr = "";
  if (lat !== null && lon !== null) {
    const country = crg.get_country(lat, lon);
    if (country) {
      locationStr = chalk.green(`${country.name} (${country.code})`);
    }
  }

  if (flight.onGround) {
    console.log(
      `${aircraftStr} (${registrationStr}): ${chalk.greenBright("on ground")} ${distStr} @ ${coordStr} ${locationStr}`,
    );
  } else {
    const routeStr = `${chalk.blue(flight.origin)} ${chalk.white("→")} ${chalk.blue(flight.destination)}`;
    console.log(
      `${aircraftStr} (${registrationStr}): ${routeStr} ${distStr} @ ${coordStr} ${locationStr}`,
    );
  }
}

/**
 * Display list of aircraft flights sorted by distance
 */
export function displayAircraftFlights(flights: AircraftFlightEntry[]): void {
  flights
    .sort((a, b) => a.closestAirport.distance - b.closestAirport.distance)
    .forEach(displayAircraftFlight);
}

/**
 * Display missing aircraft types summary
 */
export function displayMissingAircraftTypes(
  aircraftTypes: string[],
  foundTypes: Set<string>,
): void {
  const missing = aircraftTypes.filter((type) => !foundTypes.has(type));

  if (missing.length) {
    console.log(
      chalk.redBright(`Missing aircraft types: `) +
        chalk.white(missing.join(", ")),
    );
  } else {
    console.log(chalk.greenBright("All aircraft types found!"));
  }
}

/**
 * Display airports sorted by distance
 */
export function displayAirportsByDistance(
  airports: AirportDistance[],
  flightsByOrigin: Record<string, BackwardFlightEntry[]>,
): void {
  console.log(
    chalk.bold.cyan(
      `\n📍 TOP ${TOP_AIRPORTS_TO_DISPLAY} SOURCE AIRPORTS BY DISTANCE`,
    ),
  );
  console.log(chalk.gray("Airports sorted by distance from origin:\n"));

  const topAirports = airports.slice(0, TOP_AIRPORTS_TO_DISPLAY);

  topAirports.forEach((airport, index) => {
    const rankStr = chalk.gray(`${(index + 1).toString().padStart(2)}.`);
    const codeStr = chalk.bold.yellow(airport.code);
    const nameStr = chalk.white(airport.name);
    const countryStr = chalk.gray(`(${airport.country})`);
    const distStr = chalk.magenta(`${airport.distance.toFixed(0)}km`);
    const flightStr = chalk.cyan(
      `${airport.flightCount} flight${airport.flightCount === 1 ? "" : "s"}`,
    );

    console.log(
      `${rankStr} ${codeStr} ${nameStr} ${countryStr} - ${distStr} - ${flightStr}`,
    );

    // Display flights for this airport
    const flights = flightsByOrigin[airport.code] || [];
    flights
      .sort((a, b) => a.time - b.time)
      .forEach((flight) => {
        const flightDate = new Date(flight.time);
        const statusColor = getStatusColor(flight.status);

        console.log(
          `      ${chalk.gray(formatTime(flightDate))} - ${chalk.cyan(flight.code)} → ${chalk.white(flight.target)} ${statusColor(flight.status)}`,
        );
      });

    console.log(""); // Empty line between airports
  });

  if (airports.length > TOP_AIRPORTS_TO_DISPLAY) {
    console.log(
      chalk.gray(
        `... and ${airports.length - TOP_AIRPORTS_TO_DISPLAY} more airports`,
      ),
    );
  }
}

/**
 * Display airports by distance analysis summary
 */
export function displayAirportsDistanceSummary(
  airports: AirportDistance[],
): void {
  console.log(
    chalk.bold.green(`\n✨ Found ${airports.length} source airports`),
  );

  if (airports.length > 0) {
    const closest = airports[0]!;
    const farthest = airports[airports.length - 1]!;
    console.log(
      chalk.gray(
        `📏 Distance range: ${closest.distance.toFixed(0)}km - ${farthest.distance.toFixed(0)}km`,
      ),
    );
  }
}
