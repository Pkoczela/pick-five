# Plan 7 — Standings, History, Payments, and Audit

## Outcome

Replace the workbook summary and operational tracking with reliable finalized history, season standings, payment status, and a commissioner-readable audit trail.

## Work packages

### 7.1 Payment management

- Create a week payment row for each relevant active member or lazily upsert it on first edit.
- Support expected, received, status, paid timestamp, note, and actor in the domain even if V1 initially exposes a paid/unpaid control.
- Show the player their own payment state.
- Show commissioner submitted, participating, paid, expected, and received counts.
- Require audit events for waivers, partials if exposed, amount changes, and post-finalization edits.
- Keep entry acceptance separate from payment, applying unpaid eligibility only at resolution if configured.

### 7.2 Submission status

Before lock, provide a metadata-only default table:

- member;
- submitted/missing;
- submitted timestamp;
- paid/unpaid.

Include filter/copy-friendly missing and unpaid lists for use with the existing group text. Put pick details behind the explicit permissioned action.

### 7.3 Weekly results

For a final week, show:

- resolution and winner(s);
- winning five picks where applicable;
- prediction, actual total, and error when relevant;
- payout and rollover out;
- all player results ordered by correct count and deterministic secondary order;
- manual-resolution notes without exposing sensitive internal diagnostics.

### 7.4 History

- List finalized weeks by season and week.
- Card fields: week, jackpot/payout, winner or no winner, top score, rollover out.
- Link each card to immutable finalized results.
- Clearly label reopened weeks and do not present stale snapshots as final.

### 7.5 Season leaderboard

Calculate only from finalized valid entries:

- total correct;
- weeks entered;
- average correct;
- 5–0 wins;
- total winnings.

Rank by total correct, then average correct, then player display name as a deterministic display order. Define handling of renamed and inactive players so historical identity remains stable.

Avoid persisted aggregate drift unless a refreshable materialized view is justified. A query/view over finalized snapshots is sufficient for V1 scale.

### 7.6 Audit log

Commissioner view should support chronological browsing and basic filters for actor, event type, entity, and week.

Render friendly summaries for at least:

- line changed after publish;
- commissioner-edited entry;
- score or ATS override;
- contribution/financial override;
- payment adjustment;
- tiebreaker change after publish;
- week reopened/re-finalized;
- manual or split winner resolution;
- member role/active-state change.

Raw JSON may be available in a details disclosure, but the default view should explain the action in pool language.

### 7.7 Member administration

- Add an invited/unclaimed member with normalized email and display name.
- Change role with owner-level protection against removing the last owner.
- Deactivate/reactivate without deleting history.
- Link claimed account status visibly.
- Never recycle historical membership identity for a different person.

## Tests and acceptance evidence

- Players can read only their own payment state; commissioners can edit league-scoped payment records.
- Payment changes do not mutate a submitted entry.
- Standings totals equal hand-calculated finalized fixtures and exclude draft/reopened weeks.
- Rank ties follow the specified deterministic order.
- Historical results remain readable for inactive members.
- Required override paths create audit events with reason and before/after data.
- Players cannot modify or erase audit records.

## Exit criteria

- Commissioner no longer needs the workbook summary sheet for entries, payments, results, rollover, or standings.
- Players can independently review current payment state and past results.
- Every sensitive correction has a human-readable audit record.
- Leaderboard values are reproducible from finalized weekly snapshots.
