/** Shared display formatting. League time is always US Eastern. */
const LEAGUE_TIME_ZONE = "America/New_York";

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function formatSpread(value: number) {
  return value === 0 ? "PK" : `${value > 0 ? "+" : ""}${value}`;
}

/** e.g. "Sun, Oct 11, 1:00 PM EDT" */
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: LEAGUE_TIME_ZONE, timeZoneName: "short" }).format(new Date(value));
}

/** e.g. "Sun 1:00 PM" — compact, for dense lists. */
export function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: LEAGUE_TIME_ZONE }).format(new Date(value));
}

/** e.g. "Oct 11, 2026, 1:00 PM EDT" */
export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: LEAGUE_TIME_ZONE, timeZoneName: "short" }).format(new Date(value));
}

export function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
