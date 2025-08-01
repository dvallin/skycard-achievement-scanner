# Flightradar - Skycards Achievement Scanner

A TypeScript/Bun project for scanning real-time flight data to help unlock achievements in Skycards using the FlightRadar24 API.

## Installation

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

## Current Usecases

### Rare Aircraft Scanner
Find flights with specific rare aircraft types:
```bash
bun run rare-flights.ts
```

### Flights to Asia (Forward Search)
Search for flights departing to Asian countries:
```bash
bun run flights-to-asia.ts
```

### Flights to Asia (Reverse Search)
Search for flights arriving at Asian airports:
```bash
bun run flights-to-asia-reverse.ts
```

## Configuration

Edit aircraft types in `rare-flights.ts`:
```typescript
const remainingAircrafts = ["H269", "A5", "L410", "M5", "SONX", ...];
```

Change source airport:
```typescript
const sourceAirport = "HAM"; // Hamburg
```

## Output

- 🔵 Scheduled | 🟡 Departed | 🟢 Arrived | 🔴 Error
- Shows aircraft type, flight number, route, distance, and coordinates

## Features

- Real-time flight tracking
- Rate limiting to respect API limits
- Color-coded terminal output
- Rare aircraft detection
- Regional flight discovery
