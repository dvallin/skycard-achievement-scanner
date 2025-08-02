import type { FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import { getArrivals } from "../get-arrivals";
import { getDepartures } from "../get-departures";
import type {
  ForwardFlightEntry,
  BackwardFlightEntry,
  AircraftFlightEntry,
} from "./types";
import { isToday, sleep } from "./utils";
import { DELAY_BETWEEN_CALLS_MS, MAX_RETRY_ATTEMPTS } from "./constants";

/**
 * Transforms API arrival data to BackwardFlightEntry format
 */
export function transformToBackwardFlightEntry(
  apiResponse: any,
  targetAirport: string,
): BackwardFlightEntry {
  const time = apiResponse.time;
  const origin = apiResponse.airport.origin;
  const status: "arrived" | "departed" | "scheduled" =
    apiResponse.time?.real.departure != null
      ? apiResponse.time.real.arrival != null
        ? "arrived"
        : "departed"
      : "scheduled";

  return {
    target: targetAirport,
    live: apiResponse.status.live,
    status,
    code: apiResponse.identification.number.default,
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
}

/**
 * Transforms API departure data to ForwardFlightEntry format
 */
export function transformToForwardFlightEntry(
  apiResponse: any,
): ForwardFlightEntry {
  const time = apiResponse.time;
  const destination = apiResponse.airport.destination;
  const status: "arrived" | "departed" | "scheduled" =
    apiResponse.time?.real.departure != null
      ? apiResponse.time.real.arrival != null
        ? "arrived"
        : "departed"
      : "scheduled";

  return {
    live: apiResponse.status.live,
    status,
    code: apiResponse.identification.number.default,
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
}

/**
 * Filters flights to only include those happening today
 */
export function filterFlightsForToday<T extends { time: number }>(
  flights: T[],
): T[] {
  return flights.filter((flight) => isToday(flight.time));
}

/**
 * Groups backward flights by their origin airport code
 */
export function groupFlightsByOrigin(
  flights: BackwardFlightEntry[],
): Record<string, BackwardFlightEntry[]> {
  const grouped: Record<string, BackwardFlightEntry[]> = {};

  for (const flight of flights) {
    const code = flight.origin.code || "UNKNOWN";
    if (!grouped[code]) {
      grouped[code] = [];
    }
    grouped[code].push(flight);
  }

  return grouped;
}

/**
 * Filters forward flights to only include specified destination airports
 */
export function filterByDestinations(
  flights: ForwardFlightEntry[],
  destinationAirports: string[],
): ForwardFlightEntry[] {
  return flights.filter(
    (flight) =>
      flight.destination.code &&
      destinationAirports.includes(flight.destination.code),
  );
}

/**
 * Fetches arrivals for an airport with retry logic
 */
export async function fetchArrivalsWithRetry(
  api: FlightRadar24API,
  airport: string,
): Promise<BackwardFlightEntry[]> {
  let attempts = 0;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      console.log(chalk.gray(`Fetching arrivals for ${airport}...`));
      const flights = await getArrivals(api, airport);

      return flights.map((f) => transformToBackwardFlightEntry(f, airport));
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

/**
 * Fetches departures for an airport
 */
export async function fetchDepartures(
  api: FlightRadar24API,
  airport: string,
): Promise<ForwardFlightEntry[]> {
  console.log(chalk.gray(`Fetching departures for ${airport}...`));
  const flights = await getDepartures(api, airport);
  return flights.map(transformToForwardFlightEntry);
}

/**
 * Fetches arrivals for multiple airports with delays between calls
 */
export async function fetchAllArrivals(
  api: FlightRadar24API,
  airports: string[],
): Promise<BackwardFlightEntry[]> {
  const allFlights: BackwardFlightEntry[] = [];

  for (const airport of airports) {
    const flights = await fetchArrivalsWithRetry(api, airport);
    allFlights.push(...flights);
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return allFlights;
}

/**
 * Transforms API flight data to AircraftFlightEntry format
 */
export function transformToAircraftFlightEntry(
  apiResponse: any,
  entity: any,
): AircraftFlightEntry {
  return {
    live: apiResponse.status?.live ?? false,
    status: "scheduled" as const, // Aircraft flights don't have arrival/departure status
    code: apiResponse.identification?.number?.default ?? "",
    time: Date.now(), // Use current time for aircraft flights
    distance: apiResponse.getDistanceFrom(entity),
    onGround: apiResponse.onGround !== 0,
    coordinates: [apiResponse.latitude, apiResponse.longitude] as [
      number | null,
      number | null,
    ],
    number: apiResponse.number,
    aircraftCode: apiResponse.aircraftCode,
    origin: apiResponse.originAirportIata,
    destination: apiResponse.destinationAirportIata,
  };
}

/**
 * Fetches flights by aircraft type
 */
export async function fetchFlightsByType(
  api: FlightRadar24API,
  entity: any,
  aircraftType: string,
): Promise<AircraftFlightEntry[]> {
  const flights = await api.getFlights(null, null, null, aircraftType);
  const result = flights.map((flight: any) =>
    transformToAircraftFlightEntry(flight, entity),
  );
  result.sort((a, b) => a.distance - b.distance);
  return result;
}
