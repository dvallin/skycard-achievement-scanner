import { FlightRadar24API } from "flightradarapi";
import chalk, { type ChalkInstance } from "chalk";
import { getDepartures } from "./get-departures";

// Types
interface FlightEntry {
  live: boolean;
  status: "arrived" | "departed" | "scheduled";
  code: string;
  time: number;
  destination: {
    country?: { name?: string };
    code?: string;
    name?: string;
  };
}

interface TimeWindow {
  start: number;
  end: number;
  destinations: Set<string>;
  flights: FlightEntry[];
}

// Constants
const WINDOW_SIZE_MS = 30 * 60 * 1000; // 30 minutes
const FLIGHTS_TO_DISPLAY = 5;
const WINDOWS_TO_DISPLAY = 3;

// Utility functions
function formatTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}. ${hours}:${minutes}`;
}

function getStatusColor(status: string): ChalkInstance {
  switch (status) {
    case "arrived":
      return chalk.green;
    case "departed":
      return chalk.yellow;
    case "scheduled":
      return chalk.blue;
    default:
      return chalk.white;
  }
}

// Window analysis
function findOptimalWindows(flights: FlightEntry[]): TimeWindow[] {
  if (flights.length === 0) return [];

  const sortedFlights = flights.slice().sort((a, b) => a.time - b.time);
  let maxUniqueDestinations = 0;
  let bestWindows: TimeWindow[] = [];
  const now = Date.now();

  for (let i = 0; i < sortedFlights.length; i++) {
    const currentFlight = sortedFlights[i];
    if (!currentFlight) continue;
    const windowStart = currentFlight.time;
    // Only consider windows that start no more than 15 minutes in the past
    if (windowStart < now - WINDOW_SIZE_MS / 2) continue;
    const windowEnd = windowStart + WINDOW_SIZE_MS;
    const windowFlights: FlightEntry[] = [];
    const uniqueDestinations = new Set<string>();

    // Collect flights within the 30-minute window
    for (let j = i; j < sortedFlights.length; j++) {
      const flight = sortedFlights[j];
      if (!flight) continue;
      if (flight.time <= windowEnd) {
        windowFlights.push(flight);
        if (flight.destination.code) {
          uniqueDestinations.add(flight.destination.code);
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

// Display functions
function displayWindowFlights(window: TimeWindow): void {
  console.log(chalk.gray("   ✈️  Flights:"));

  const flightsToShow = window.flights
    .sort((a, b) => a.time - b.time)
    .slice(0, FLIGHTS_TO_DISPLAY);

  flightsToShow.forEach((flight) => {
    const flightDate = new Date(flight.time);
    const statusColor = getStatusColor(flight.status);

    console.log(
      `      ${chalk.gray(formatTime(flightDate))} - ${chalk.cyan(flight.code)} → ${chalk.bold(flight.destination.name)} (${chalk.gray(flight.destination.code)}) ${statusColor(flight.status)}`,
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

function displayOptimalWindowAnalysis(
  flights: FlightEntry[],
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

  const bestWindows = findOptimalWindows(flights);

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

  const windowsToShow = bestWindows.slice(0, WINDOWS_TO_DISPLAY);

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

    displayWindowFlights(window);
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

export async function fowardLookup(
  api: FlightRadar24API,
  sourceAirport: string,
  destinationAirports: string[],
  onlyToday = true,
) {
  console.log(`flights from ${sourceAirport}`);
  const flights = await getDepartures(api, sourceAirport);
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  let allFlights: FlightEntry[] = flights.map((f) => {
    const time = f.time;
    const destination = f.airport.destination;
    const status =
      f.time?.real.departure != null
        ? f.time.real.arrival != null
          ? "arrived"
          : "departed"
        : "scheduled";
    return {
      live: f.status.live,
      status: status,
      code: f.identification.number.default,
      time:
        (time?.real.departure ??
          time?.estimated.departure ??
          time?.scheduled.departure ??
          0) * 1000,
      destination: {
        country: destination?.position?.country,
        code: destination?.code?.iata,
        name: destination?.position?.region.city,
      },
    };
  });

  allFlights = allFlights.filter(
    (flight) =>
      flight.destination.code &&
      destinationAirports.includes(flight.destination.code),
  );

  if (onlyToday) {
    allFlights = allFlights.filter(
      (flight) => flight.time >= todayStart && flight.time < todayEnd,
    );
  }

  // Display individual flights
  console.log(chalk.bold.cyan("\n📋 DEPARTURE SCHEDULE"));
  allFlights
    .sort((a, b) => a.time - b.time)
    .forEach((e) => {
      const date = new Date(e.time);
      const statusColor = getStatusColor(e.status);

      console.log(
        `${chalk.gray(formatTime(date))} - ${chalk.cyan(e.code)} ${chalk.magenta(e.destination.name)} (${chalk.gray(e.destination?.country?.name)}) ${statusColor(e.status)}`,
      );
    });

  // Analyze and display optimal 30-minute windows
  displayOptimalWindowAnalysis(allFlights, sourceAirport);
}
