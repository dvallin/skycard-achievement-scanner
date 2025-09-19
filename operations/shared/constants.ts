// Time-based constants
export const DELAY_BETWEEN_CALLS_MS = 2000; // 2 seconds - more conservative for rate limiting
export const EXPONENTIAL_BACKOFF_BASE_MS = 1000; // Base delay for exponential backoff
export const EXPONENTIAL_BACKOFF_MULTIPLIER = 2; // Multiplier for exponential backoff

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3; // Reduced attempts to fail faster

// Display limits
export const TOP_AIRPORTS_TO_DISPLAY = 10;
