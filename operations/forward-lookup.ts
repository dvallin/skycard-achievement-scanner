import type { FlightRadar24API } from "flightradarapi";
import {
  fetchDepartures,
  filterFlightsForToday,
  filterByDestinations,
  displayDepartureSchedule,
  analyzeDeparturesByDiversity,
  displayDepartureDiversitySummary,
} from "./shared";

export async function fowardLookup(
  api: FlightRadar24API,
  sourceAirport: string,
  destinationAirports: string[],
  onlyToday = true,
): Promise<void> {
  console.log(`flights from ${sourceAirport}`);

  // Fetch all departure flights from the source airport
  let allFlights = await fetchDepartures(api, sourceAirport);

  // Filter to only include flights to specified destination airports
  allFlights = filterByDestinations(allFlights, destinationAirports);

  // Filter to today's flights if requested
  if (onlyToday) {
    allFlights = filterFlightsForToday(allFlights);
  }

  // Display individual departure flights
  displayDepartureSchedule(allFlights);

  // Analyze and display departure diversity
  const diversityData = analyzeDeparturesByDiversity(allFlights, sourceAirport);
  if (diversityData) {
    displayDepartureDiversitySummary(diversityData, allFlights);
  }
}
