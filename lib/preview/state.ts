/**
 * Design-preview state. Lives in one browser cookie so the real server-rendered
 * pages can render sample data for the chosen scenario. Never used in production
 * (see isPreviewMode) and never contains real league data.
 */
export const PREVIEW_COOKIE = "pf_preview";

export const previewScenarios = ["Open", "Submitted", "Locked", "Live", "Final", "Empty", "Error", "Loading"] as const;
export type PreviewScenario = (typeof previewScenarios)[number];
export type PreviewRole = "OWNER" | "PLAYER";
export type PreviewEntry = { picks: Record<string, "HOME" | "AWAY">; tiebreaker: number };

export type PreviewState = {
  scenario: PreviewScenario;
  role: PreviewRole;
  failSaves: boolean;
  entry: PreviewEntry | null;
};

export const defaultPreviewState: PreviewState = { scenario: "Open", role: "OWNER", failSaves: false, entry: null };

export function parsePreviewState(raw: string | undefined): PreviewState {
  if (!raw) return defaultPreviewState;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<PreviewState>;
    return {
      scenario: previewScenarios.includes(value.scenario as PreviewScenario) ? value.scenario as PreviewScenario : "Open",
      role: value.role === "PLAYER" ? "PLAYER" : "OWNER",
      failSaves: value.failSaves === true,
      entry: isEntry(value.entry) ? value.entry : null,
    };
  } catch {
    return defaultPreviewState;
  }
}

export function serializePreviewState(state: PreviewState) {
  return encodeURIComponent(JSON.stringify(state));
}

function isEntry(value: unknown): value is PreviewEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as PreviewEntry;
  return typeof entry.tiebreaker === "number" && typeof entry.picks === "object" && entry.picks !== null
    && Object.values(entry.picks).every((side) => side === "HOME" || side === "AWAY");
}
