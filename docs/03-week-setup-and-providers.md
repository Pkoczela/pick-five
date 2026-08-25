# Plan 3 — Commissioner Week Setup and Providers

## Outcome

A commissioner can create a season and week, import the NFL schedule, enter official spreads, choose a tiebreaker game, and publish an entry-ready week without Excel.

## Work packages

### 3.1 Season and week management

- Create/open/complete a season.
- Create a unique week with NFL week, season type, entry fee, lock timestamp, and note.
- Display deadlines in league timezone and store them as `timestamptz`.
- Prevent player entry while the week is `DRAFT`.
- Allow a draft to be archived only when it has no dependent submissions.

### 3.2 Provider contracts

Define provider-neutral types for schedule and score data. The application domain must not import ESPN response types outside the adapter.

Adapter output should include:

- provider and event ID;
- kickoff and normalized status;
- home/away team identity;
- scores where present;
- completion marker and source update time.

### 3.3 ESPN adapter

- Make server-side requests with year, week, and season type.
- Apply a finite timeout and one or two retries only for transient errors.
- Validate the response defensively; return descriptive commissioner-safe errors.
- Log/record last successful synchronization.
- Preserve raw diagnostic context server-side without exposing secrets or excessive provider payloads.
- Add fixture-based tests for scheduled, in-progress, final, postponed, canceled, incomplete, and malformed games.

### 3.4 Idempotent import

- Upsert by provider and event ID.
- Map provider teams through stable IDs, with abbreviation/name fallback only as a reviewed exception.
- Update schedule/status/score fields while preserving commissioner overrides.
- Never delete games absent from an incomplete response.
- Flag unexpected duplicates or changed identities for commissioner review.
- Provide manual game create/edit/disable controls as an emergency fallback.

### 3.5 Spread manager

- Enter the spread from the home-team perspective.
- Show both home and away display spreads automatically.
- Validate increments/precision selected in Plan 0 and support pick’em.
- Track draft, published, and overridden revisions with source metadata.
- Require complete official lines for all selectable games before publish.
- Never let schedule or optional odds refresh alter an official published revision.

### 3.6 Tiebreaker selection

- Suggest the latest Monday game after import.
- Require commissioner confirmation and allow any valid week game for exceptional schedules.
- Warn if a tiebreaker game is postponed, canceled, or disabled.

### 3.7 Publish transaction

Within one authorized transaction, verify:

- at least one selectable game exists;
- every selectable game has a current official spread;
- a valid tiebreaker game is selected;
- `lock_at` is in the future;
- the week is not final/reopened in a disallowed condition.

Then mark line revisions published and transition the week to `OPEN`. Partial publish must not be possible.

### 3.8 Published edits

- Display a strong warning when submissions exist.
- Require new value, reason, and explicit confirmation.
- Insert a line revision and audit event.
- Queue/recompute affected pick scoring without losing the submitted line reference.
- Treat lock or tiebreaker changes after submission as similarly sensitive audited actions.

## Commissioner screens

- Dashboard summary with week state and setup completeness.
- Manage Week form and schedule import status.
- Spread Manager with missing/draft/published/overridden states.
- Tiebreaker chooser.
- Publish readiness checklist with direct links to incomplete items.

## Tests and acceptance evidence

- Repeated ESPN imports do not duplicate games.
- Incomplete provider responses do not delete stored games.
- Score overrides survive refresh.
- A week with a missing line, missing tiebreaker, past lock, or no games cannot publish.
- A complete week publishes atomically and is visible to players.
- A post-publish line change requires a reason, keeps both revisions, and creates an audit event.

## Exit criteria

- A commissioner can publish a complete real NFL week without editing the database.
- Provider outages leave existing schedule data usable and offer a clear retry/manual path.
- All official lines are explicit commissioner-approved records.
- Optional odds prefill has not become a dependency for launch.
