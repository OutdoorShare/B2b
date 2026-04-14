/**
 * booking-fetch.ts — typed, retry-capable fetch utilities for booking flows.
 *
 * Error taxonomy (maps 1-to-1 with HTTP status codes from the API server):
 *   NOT_FOUND          → 404  booking / resource does not exist
 *   ACCESS_DENIED      → 401 / 403  authentication / ownership failure
 *   BOOKING_STATE_INVALID → 409 / 422  booking in wrong state for this operation
 *   TRANSIENT_ERROR    → 5xx / network  temporary, safe to retry
 *
 * Recovery mapping (used by the UI to decide what to show):
 *   NOT_FOUND          → redirect to list with message
 *   ACCESS_DENIED      → redirect to login
 *   BOOKING_STATE_INVALID → re-fetch canonical state, then redirect
 *   TRANSIENT_ERROR    → auto-retry (silent), then show retry button on exhaustion
 */

export type BookingErrorCode =
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "BOOKING_STATE_INVALID"
  | "TRANSIENT_ERROR";

export class BookingFetchError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "BookingFetchError";
  }
}

function errorCodeFor(status: number): BookingErrorCode {
  if (status === 404) return "NOT_FOUND";
  if (status === 401 || status === 403) return "ACCESS_DENIED";
  if (status === 409 || status === 422) return "BOOKING_STATE_INVALID";
  return "TRANSIENT_ERROR";
}

/**
 * fetchWithRetry — fetch with exponential back-off for transient (5xx / network) errors.
 *
 * Only retries when the failure is clearly transient:
 *   - Network error (no response at all)
 *   - HTTP 5xx
 *
 * Auth (401/403), not-found (404), and state (409/422) failures are returned
 * immediately as typed BookingFetchErrors — retrying them is useless.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.ok) return res;

      const isTransient = res.status >= 500;
      if (!isTransient || attempt === maxAttempts) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new BookingFetchError(
          errorCodeFor(res.status),
          res.status,
          typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        );
      }

      lastErr = new BookingFetchError("TRANSIENT_ERROR", res.status, `HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof BookingFetchError) throw err;
      lastErr = err;
      if (attempt === maxAttempts) break;
    }

    const jitter = Math.random() * 400;
    await new Promise(r => setTimeout(r, attempt * 800 + jitter));
  }

  throw new BookingFetchError("TRANSIENT_ERROR", 0, "Network error — please check your connection.");
}

/**
 * loadBooking — typed, resilient booking loader.
 *
 * Returns the parsed booking JSON on success.
 * Throws BookingFetchError on any failure (typed, ready for UI mapping).
 */
export async function loadBooking(
  apiBase: string,
  bookingId: string | number,
  customerEmail: string,
): Promise<Record<string, unknown>> {
  const url = `${apiBase}/api/bookings/${bookingId}?customerEmail=${encodeURIComponent(customerEmail)}`;
  const res = await fetchWithRetry(url, undefined, 3);
  const data = await res.json() as Record<string, unknown>;

  if (data.error) {
    throw new BookingFetchError("NOT_FOUND", 200, String(data.error));
  }

  const emailMatch =
    typeof data.customerEmail === "string" &&
    data.customerEmail.toLowerCase().trim() === customerEmail.toLowerCase().trim();

  if (!emailMatch) {
    throw new BookingFetchError("ACCESS_DENIED", 403, "You don't have permission to view this booking.");
  }

  return data;
}

/**
 * Friendly messages + recovery hints for each error code.
 */
export function bookingErrorUX(code: BookingErrorCode): {
  title: string;
  description: string;
  canRetry: boolean;
  suggestBack: boolean;
} {
  switch (code) {
    case "NOT_FOUND":
      return {
        title: "Booking not found",
        description: "This booking no longer exists or the link may be outdated.",
        canRetry: false,
        suggestBack: true,
      };
    case "ACCESS_DENIED":
      return {
        title: "Access denied",
        description: "You don't have permission to view this booking. Make sure you're signed in with the right account.",
        canRetry: false,
        suggestBack: true,
      };
    case "BOOKING_STATE_INVALID":
      return {
        title: "Booking unavailable",
        description: "This booking is in an unexpected state. Try refreshing to get the latest information.",
        canRetry: true,
        suggestBack: false,
      };
    case "TRANSIENT_ERROR":
    default:
      return {
        title: "Temporarily unavailable",
        description: "We couldn't reach our servers. Please check your connection and try again.",
        canRetry: true,
        suggestBack: false,
      };
  }
}
