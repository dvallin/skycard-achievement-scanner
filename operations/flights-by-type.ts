import chalk from "chalk";
import type { Entity, Flight, FlightRadar24API } from "flightradarapi";
import pLimit from "p-limit";
const limit = pLimit(5);

export async function flightsByTypes(
  api: FlightRadar24API,
  entity: Entity,
  ...aircraftTypes: string[]
) {
  const requests = aircraftTypes.map((aircraftType) =>
    limit(() => flightsByType(api, entity, aircraftType)),
  );
  const allResults = await Promise.all(requests);
  const results = allResults.flatMap((i) => i);
  results
    .sort((a, b) => a.distance - b.distance)
    .map(({ flight, distance }) => {
      return {
        distance,
        onGround: flight.onGround != 0,
        coordinates: [flight.latitude, flight.longitude],
        number: flight.number,
        aircraftCode: flight.aircraftCode,
        origin: flight.originAirportIata,
        destination: flight.destinationAirportIata,
      };
    })
    .forEach((e) => {
      const aircraftStr = chalk.cyan.bold(e.aircraftCode);
      const numberStr = chalk.yellow(e.number);
      const distStr = chalk.magenta(`${e.distance.toFixed()}km`);
      const coordStr = chalk.gray(
        `[${e.coordinates.map((c) => c?.toFixed(3)).join(", ")}]`,
      );
      if (e.onGround) {
        console.log(
          `${aircraftStr} (${numberStr}): ${chalk.greenBright("on ground")} ${distStr} @ ${coordStr}`,
        );
      } else {
        const routeStr = `${chalk.blue(e.origin)} ${chalk.white("→")} ${chalk.blue(e.destination)}`;
        console.log(
          `${aircraftStr} (${numberStr}): ${routeStr} ${distStr} @ ${coordStr}`,
        );
      }
    });

  const seen = new Set(results.map((a) => a.flight.aircraftCode));
  const missing = aircraftTypes.filter((a) => !seen.has(a));
  if (missing.length) {
    console.log(
      chalk.redBright(`Missing aircraft types: `) +
        chalk.white(missing.join(", ")),
    );
  } else {
    console.log(chalk.greenBright("All aircraft types found!"));
  }
}

async function flightsByType(
  api: FlightRadar24API,
  entity: Entity,
  aircraftType: string,
): Promise<{ flight: Flight; distance: number }[]> {
  const flights = await api.getFlights(null, null, null, aircraftType);
  const result = flights.map((flight) => ({
    flight,
    distance: flight.getDistanceFrom(entity),
  }));
  result.sort((a, b) => a.distance - b.distance);
  return result;
}
