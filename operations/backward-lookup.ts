import chalk, { type ChalkInstance } from "chalk";
import { getArrivals } from "./get-arrivals";
import type { FlightRadar24API } from "flightradarapi";

// Types
interface FlightEntry {
  target: string;
  live: boolean;
  status: "arrived" | "departed" | "scheduled";
  code: string;
  time: number;
  origin: {
    country?: string;
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

interface AirportAnalysis {
  airportCode: string;
  airportName: string;
  maxDestinations: number;
  bestWindows: TimeWindow[];
}

// Constants
const WINDOW_SIZE_MS = 30 * 60 * 1000; // 30 minutes
const DELAY_BETWEEN_CALLS_MS = 1500; // 1.5 seconds
const MAX_RETRY_ATTEMPTS = 5;
const FLIGHTS_TO_DISPLAY = 5;
const WINDOWS_TO_DISPLAY = 3;
const AIRPORTS_TO_DISPLAY = 4;

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function filterFlightsForToday(flights: FlightEntry[]): FlightEntry[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  return flights.filter(
    (flight) => flight.time >= todayStart && flight.time < todayEnd,
  );
}

function groupFlightsByOrigin(
  flights: FlightEntry[],
): Record<string, FlightEntry[]> {
  const grouped: Record<string, FlightEntry[]> = {};

  for (const flight of flights) {
    const code = flight.origin.code || "UNKNOWN";
    if (!grouped[code]) {
      grouped[code] = [];
    }
    grouped[code].push(flight);
  }

  return grouped;
}

// Flight fetching
async function fetchFlightsWithRetry(
  api: FlightRadar24API,
  airport: string,
): Promise<FlightEntry[]> {
  let attempts = 0;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      console.log(chalk.gray(`Fetching arrivals for ${airport}...`));
      const flights = await getArrivals(api, airport);

      return flights.map((f) => {
        const time = f.time;
        const origin = f.airport.origin;
        const status: "arrived" | "departed" | "scheduled" =
          f.time?.real.departure != null
            ? f.time.real.arrival != null
              ? "arrived"
              : "departed"
            : "scheduled";

        return {
          target: airport,
          live: f.status.live,
          status,
          code: f.identification.number.default,
          time:
            (time?.real.departure ??
              time?.estimated.departure ??
              time?.scheduled.departure ??
              0) * 1000,
          origin: {
            country: origin?.position?.country?.name,
            code: origin?.code?.iata,
            name: origin?.position?.region.city,
          },
        };
      });
    } catch (error: any) {
      attempts++;

      if (String(error).includes("429")) {
        console.error(
          chalk.red(
            `Rate limit hit for ${airport} (429 Too Many Requests). ` +
              `Retrying in ${DELAY_BETWEEN_CALLS_MS}ms... (Attempt ${attempts}/${MAX_RETRY_ATTEMPTS})`,
          ),
        );
        await sleep(DELAY_BETWEEN_CALLS_MS);
      } else {
        console.error(
          chalk.red(`Failed to fetch arrivals for ${airport}: ${error}`),
        );
        break;
      }
    }
  }

  return [];
}

async function fetchAllFlights(
  api: FlightRadar24API,
  airports: string[],
): Promise<FlightEntry[]> {
  const allFlights: FlightEntry[] = [];

  for (const airport of airports) {
    const flights = await fetchFlightsWithRetry(api, airport);
    allFlights.push(...flights);
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return allFlights;
}

// Window analysis
function findOptimalWindowsForAirport(flights: FlightEntry[]): TimeWindow[] {
  if (flights.length === 0) return [];

  const sortedFlights = flights.slice().sort((a, b) => a.time - b.time);
  let maxUniqueDestinations = 0;
  let bestWindows: TimeWindow[] = [];
  const now = Date.now();

  for (let i = 0; i < sortedFlights.length; i++) {
    const currentFlight = sortedFlights[i];
    if (!currentFlight) continue;
    const windowStart = currentFlight.time;
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
        uniqueDestinations.add(flight.target);
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

function analyzeAllAirports(
  flightsByOrigin: Record<string, FlightEntry[]>,
): AirportAnalysis[] {
  const airportResults: AirportAnalysis[] = [];

  for (const [originCode, airportFlights] of Object.entries(flightsByOrigin)) {
    if (airportFlights.length === 0) continue;

    const bestWindows = findOptimalWindowsForAirport(airportFlights);

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

// Display functions
function displayFlightsByOrigin(
  flightsByOrigin: Record<string, FlightEntry[]>,
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

function displayWindowFlights(window: TimeWindow): void {
  console.log(chalk.gray("   ✈️  Flights:"));

  const flightsToShow = window.flights
    .sort((a, b) => a.time - b.time)
    .slice(0, FLIGHTS_TO_DISPLAY);

  flightsToShow.forEach((flight) => {
    const flightDate = new Date(flight.time);
    const statusColor = getStatusColor(flight.status);

    console.log(
      `      ${chalk.gray(formatTime(flightDate))} - ${chalk.cyan(flight.code)} → ${chalk.bold(flight.target)} ${statusColor(flight.status)}`,
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

function displayAirportAnalysis(airport: AirportAnalysis): void {
  console.log(
    chalk.bold.yellow(`🏆 ${airport.airportCode} (${airport.airportName})`),
  );
  console.log(chalk.green(`   Max destinations: ${airport.maxDestinations}`));
  console.log(
    chalk.gray(`   Found ${airport.bestWindows.length} optimal window(s):`),
  );

  const windowsToShow = airport.bestWindows.slice(0, WINDOWS_TO_DISPLAY);

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

    displayWindowFlights(window);
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

function displayOptimalWindowAnalysis(flights: FlightEntry[]): void {
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

  const flightsByOrigin = groupFlightsByOrigin(flights);
  const airportResults = analyzeAllAirports(flightsByOrigin);

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

// Main function
export async function backwardLookup(
  api: FlightRadar24API,
  currentAirports: string[],
  onlyToday = true,
): Promise<void> {
  let allFlights = await fetchAllFlights(api, currentAirports);

  if (onlyToday) {
    allFlights = filterFlightsForToday(allFlights);
  }

  const flightsByOrigin = groupFlightsByOrigin(allFlights);

  // Display flights grouped by origin
  displayFlightsByOrigin(flightsByOrigin);

  // Analyze and display optimal 30-minute windows
  displayOptimalWindowAnalysis(allFlights);
}
