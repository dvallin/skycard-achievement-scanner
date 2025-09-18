import chalk from "chalk";
import type {
  AirportAnalysis,
  ForwardFlightEntry,
  BackwardFlightEntry,
  AircraftFlightEntry,
  AirportDistance,
  AirportDiversity,
} from "./types";
import { formatTime, getStatusColor } from "./utils";
import { TOP_AIRPORTS_TO_DISPLAY } from "./constants";
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

/**
 * Display airports sorted by diversity (number of distinct destinations)
 */
export function displayAirportsByDiversity(
  airports: AirportDiversity[],
  flightsByOrigin: Record<string, BackwardFlightEntry[]>,
): void {
  console.log(chalk.bold.cyan(`\n🎯 AIRPORTS BY DESTINATION DIVERSITY`));
  console.log(
    chalk.gray(
      "Airports sorted by number of distinct destinations and next flight:\n",
    ),
  );

  const now = Date.now();

  airports.forEach((airport, index) => {
    const rankStr = chalk.gray(`${(index + 1).toString().padStart(2)}.`);
    const codeStr = chalk.bold.yellow(airport.code);
    const nameStr = chalk.white(airport.name);
    const countryStr = chalk.gray(`(${airport.country})`);
    const diversityStr = chalk.magenta(
      `${airport.distinctDestinations} destinations`,
    );
    const flightStr = chalk.cyan(
      `${airport.totalFlights} flight${airport.totalFlights === 1 ? "" : "s"}`,
    );

    // Show next flight time
    let nextFlightStr = "";
    if (airport.nextFlightTime !== Infinity) {
      const nextFlightDate = new Date(airport.nextFlightTime);
      const timeUntil = airport.nextFlightTime - now;
      const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
      const minutesUntil = Math.floor(
        (timeUntil % (1000 * 60 * 60)) / (1000 * 60),
      );

      if (timeUntil > 0) {
        nextFlightStr = chalk.green(
          `Next: ${formatTime(nextFlightDate)} (${hoursUntil}h ${minutesUntil}m)`,
        );
      } else {
        nextFlightStr = chalk.yellow(
          `Next: ${formatTime(nextFlightDate)} (overdue)`,
        );
      }
    } else {
      nextFlightStr = chalk.red("No future flights");
    }

    console.log(
      `${rankStr} ${codeStr} ${nameStr} ${countryStr} - ${diversityStr} - ${flightStr}`,
    );
    console.log(`      ${nextFlightStr}`);

    // Show destinations
    const destinationsList = Array.from(airport.destinations).sort().join(", ");
    console.log(chalk.gray(`      Destinations: ${destinationsList}`));

    // Display recent/upcoming flights for this airport
    const flights = flightsByOrigin[airport.code] || [];
    const relevantFlights = flights
      .filter((flight) => flight.time >= now - 2 * 60 * 60 * 1000) // Last 2 hours and future
      .sort((a, b) => a.time - b.time)
      .slice(0, 3); // Show max 3 flights

    if (relevantFlights.length > 0) {
      console.log(chalk.gray("      Recent/Upcoming flights:"));
      relevantFlights.forEach((flight) => {
        const flightDate = new Date(flight.time);
        const statusColor = getStatusColor(flight.status);
        const isPast = flight.time < now;
        const timePrefix = isPast ? "  " : "→ ";

        console.log(
          `        ${timePrefix}${chalk.gray(formatTime(flightDate))} - ${chalk.cyan(flight.code)} → ${chalk.white(flight.target)} ${statusColor(flight.status)}`,
        );
      });
    }

    console.log(""); // Empty line between airports
  });
}

/**
 * Display diversity analysis summary
 */
export function displayDiversitySummary(airports: AirportDiversity[]): void {
  console.log(
    chalk.bold.green(`\n✨ Found ${airports.length} origin airports`),
  );

  if (airports.length > 0) {
    const maxDiversity = airports[0]!.distinctDestinations;
    const totalDestinations = new Set(
      airports.flatMap((airport) => Array.from(airport.destinations)),
    ).size;
    const totalFlights = airports.reduce(
      (sum, airport) => sum + airport.totalFlights,
      0,
    );

    console.log(
      chalk.gray(
        `🎯 Highest diversity: ${maxDiversity} destinations from ${airports[0]!.code}`,
      ),
    );
    console.log(
      chalk.gray(
        `📊 Total unique destinations: ${totalDestinations}, Total flights: ${totalFlights}`,
      ),
    );
  }
}

/**
 * Display departure diversity summary for forward lookup
 */
export function displayDepartureDiversitySummary(
  diversityData: {
    sourceCode: string;
    distinctDestinations: number;
    totalFlights: number;
    nextFlightTime: number;
    destinations: Set<string>;
  },
  flights: import("./types").ForwardFlightEntry[],
): void {
  console.log(
    chalk.bold.cyan(
      `\n🎯 DEPARTURE DIVERSITY FROM ${diversityData.sourceCode}`,
    ),
  );

  const diversityStr = chalk.magenta(
    `${diversityData.distinctDestinations} distinct destinations`,
  );
  const flightStr = chalk.cyan(`${diversityData.totalFlights} flights`);

  console.log(`${diversityStr} - ${flightStr}`);

  // Show next flight time
  const now = Date.now();
  if (diversityData.nextFlightTime !== Infinity) {
    const nextFlightDate = new Date(diversityData.nextFlightTime);
    const timeUntil = diversityData.nextFlightTime - now;
    const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
    const minutesUntil = Math.floor(
      (timeUntil % (1000 * 60 * 60)) / (1000 * 60),
    );

    if (timeUntil > 0) {
      console.log(
        chalk.green(
          `Next departure: ${formatTime(nextFlightDate)} (${hoursUntil}h ${minutesUntil}m)`,
        ),
      );
    } else {
      console.log(
        chalk.yellow(`Next departure: ${formatTime(nextFlightDate)} (overdue)`),
      );
    }
  } else {
    console.log(chalk.red("No future departures"));
  }

  // Show destinations
  const destinationsList = Array.from(diversityData.destinations)
    .sort()
    .join(", ");
  console.log(chalk.gray(`Destinations: ${destinationsList}`));
}
