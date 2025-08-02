import chalk from "chalk";
import { getArrivals } from "./get-arrivals";
import type { FlightRadar24API } from "flightradarapi";

// Helper function to sleep for a given number of milliseconds
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Entry = {
  target: string;
  live: boolean;
  status: string;
  code: string;
  time: number;
  origin: {
    country?: string;
    code?: string;
    name?: string;
  };
};
export async function backwardLookup(
  api: FlightRadar24API,
  currentAirports: string[],
) {
  let allFlights: Entry[] = [];

  // Set a delay between API calls to avoid hitting rate limits (429 errors)
  const DELAY_BETWEEN_CALLS_MS = 1500; // 1.5 seconds

  for (const airport of currentAirports) {
    console.log(chalk.gray(`Fetching arrivals for ${airport}...`));
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      try {
        const flights = await getArrivals(api, airport);
        allFlights = allFlights.concat(
          flights.map((f) => {
            const time = f.time;
            const origin = f.airport.origin;
            const status =
              f.time?.real.departure != null
                ? f.time.real.arrival != null
                  ? "arrived"
                  : "departed"
                : "scheduled";
            return {
              target: airport,
              live: f.status.live,
              status: status,
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
          }),
        );
        break; // Success, exit retry loop
      } catch (e: any) {
        attempts++;
        if (typeof e === "object" && e !== null && String(e).includes("429")) {
          console.error(
            chalk.red(
              `Rate limit hit for ${airport} (429 Too Many Requests). Retrying in ${DELAY_BETWEEN_CALLS_MS}ms... (Attempt ${attempts}/${maxAttempts})`,
            ),
          );
          await sleep(DELAY_BETWEEN_CALLS_MS);
        } else {
          console.error(
            chalk.red(`Failed to fetch arrivals for ${airport}: ${e}`),
          );
          break;
        }
      }
    }
    // Always wait between calls to avoid hammering the API
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  // Filter flights for today
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  allFlights = allFlights.filter(
    (flight) => flight.time >= todayStart && flight.time < todayEnd,
  );

  // Group by origin airport code
  const grouped: Record<string, Entry[]> = {};
  for (const flight of allFlights) {
    const code = flight.origin.code || "UNKNOWN";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(flight);
  }

  // Print grouped results
  Object.entries(grouped).forEach(([originCode, flights]) => {
    console.log(
      chalk.bold(
        `\n${originCode} (${flights[0]?.origin.name}, ${flights[0]?.origin.country})`,
      ),
    );
    flights
      .sort((a, b) => a.time - b.time)
      .forEach((e) => {
        const date = new Date(e.time);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        let statusColor = chalk.white;
        if (e.status === "arrived") statusColor = chalk.green;
        else if (e.status === "departed") statusColor = chalk.yellow;
        else if (e.status === "scheduled") statusColor = chalk.blue;

        console.log(
          `${chalk.gray(`${day}.${month}. ${hours}:${minutes}`)} - ${chalk.cyan(e.code)} ${e.target} ${statusColor(e.status)}`,
        );
      });
  });
}
