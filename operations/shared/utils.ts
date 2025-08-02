import chalk, { type ChalkInstance } from "chalk";

/**
 * Formats a date to DD.MM. HH:MM format
 */
export function formatTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}. ${hours}:${minutes}`;
}

/**
 * Returns appropriate chalk color for flight status
 */
export function getStatusColor(status: string): ChalkInstance {
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

/**
 * Sleep utility for delays between API calls
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets the start and end timestamps for today
 */
export function getTodayBounds(): { start: number; end: number } {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  return { start: todayStart, end: todayEnd };
}

/**
 * Checks if a timestamp is within today's bounds
 */
export function isToday(timestamp: number): boolean {
  const { start, end } = getTodayBounds();
  return timestamp >= start && timestamp < end;
}
