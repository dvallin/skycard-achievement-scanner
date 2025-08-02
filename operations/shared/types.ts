// Base flight entry interface that can be extended for specific use cases
export interface BaseFlightEntry {
  live: boolean;
  status: "arrived" | "departed" | "scheduled";
  code: string;
  time: number;
}

// Forward lookup flight entry (from source to destinations)
export interface ForwardFlightEntry extends BaseFlightEntry {
  destination: {
    country?: { name?: string };
    code?: string;
    name?: string;
  };
}

// Backward lookup flight entry (from origins to target)
export interface BackwardFlightEntry extends BaseFlightEntry {
  target: string;
  origin: {
    country?: string;
    code?: string;
    name?: string;
  };
}

// Aircraft-based flight entry (for flights-by-type operations)
export interface AircraftFlightEntry extends BaseFlightEntry {
  distance: number;
  onGround: boolean;
  coordinates: [number | null, number | null];
  registration: string;
  origin?: string;
  destination?: string;
}

// Generic flight entry that can represent any direction or type
export type FlightEntry =
  | ForwardFlightEntry
  | BackwardFlightEntry
  | AircraftFlightEntry;

// Time window for analysis
export interface TimeWindow<T extends BaseFlightEntry = BaseFlightEntry> {
  start: number;
  end: number;
  destinations: Set<string>;
  flights: T[];
}

// Airport analysis results (used in backward lookup)
export interface AirportAnalysis {
  airportCode: string;
  airportName: string;
  maxDestinations: number;
  bestWindows: TimeWindow<BackwardFlightEntry>[];
}

// Type guards to distinguish between flight entry types
export function isForwardFlightEntry(
  flight: FlightEntry,
): flight is ForwardFlightEntry {
  return "destination" in flight;
}

export function isBackwardFlightEntry(
  flight: FlightEntry,
): flight is BackwardFlightEntry {
  return "target" in flight && "origin" in flight;
}

export function isAircraftFlightEntry(
  flight: FlightEntry,
): flight is AircraftFlightEntry {
  return "distance" in flight && "aircraftCode" in flight;
}
