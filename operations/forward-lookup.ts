import { FlightRadar24API } from "flightradarapi";
import chalk from "chalk";
import { getDepartures } from "./get-departures";

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

  let allFlights = flights.map((f) => {
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

  if (onlyToday) {
    allFlights = allFlights.filter(
      (flight) =>
        flight.time >= todayStart &&
        flight.time < todayEnd &&
        flight.destination.code &&
        destinationAirports.includes(flight.destination.code),
    );
  }

  allFlights
    .sort((a, b) => a.time - b.time)
    .forEach((e) => {
      const date = new Date(e.time);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");

      // Color based on status
      let statusColor = chalk.white;
      if (e.status === "arrived") statusColor = chalk.green;
      else if (e.status === "departed") statusColor = chalk.yellow;
      else if (e.status === "scheduled") statusColor = chalk.blue;

      console.log(
        `${chalk.gray(`${day}.${month}. ${hours}:${minutes}`)} - ${chalk.cyan(e.code)} ${chalk.magenta(e.destination.name)} (${chalk.gray(e.destination?.country?.name)}) ${statusColor(e.status)}`,
      );
    });
}
