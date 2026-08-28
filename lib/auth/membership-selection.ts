export type SelectableMembership = { league: { id: string } | null };

export function selectActiveMembership<T extends SelectableMembership>(memberships: T[], requestedLeagueId?: string | null) {
  if (requestedLeagueId) {
    const requested = memberships.find((membership) => membership.league?.id === requestedLeagueId);
    if (requested) return requested;
  }
  return memberships[0] ?? null;
}
