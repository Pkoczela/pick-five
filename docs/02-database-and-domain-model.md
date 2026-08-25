# Plan 2 — Database and Domain Model

## Outcome

Build a constrained, auditable schema and typed domain layer that can safely support weekly play, scoring, overrides, payouts, history, and multiple leagues without redesign.

## Modeling principles

- UUID primary keys and explicit foreign keys.
- League ownership must be derivable for every protected row.
- Use database constraints for invariants that do not depend on external state.
- Use transactional database functions for multi-row, time-sensitive mutations.
- Preserve revisions rather than overwriting fairness- or money-sensitive history.
- Keep live/provisional records distinct from finalized snapshots.
- Use `numeric(4,1)` or an equivalent half-point-safe representation for spreads; reject unsupported precision.

## Schema workstreams

### 2.1 Identity and tenancy

Implement `profiles`, `leagues`, `league_members`, and `seasons` with:

- normalized invitation email;
- partial uniqueness for linked users and unclaimed emails;
- role and active-state constraints;
- season uniqueness by league, year, and any season-type distinction selected in Plan 0.

### 2.2 Week workflow

Implement `weeks` with the decided state enum, timestamps, entry fee, tiebreaker reference, notes, and finalization metadata.

Add constraints for:

- supported NFL week and season-type ranges;
- non-negative money;
- non-negative entry fee;
- a tiebreaker game belonging to the same week, enforced during publish through a transaction.

Avoid circular migration trouble by adding the tiebreaker foreign key after `games` exists.

### 2.3 Teams, games, and provider identity

Implement `teams` and `games`, including:

- the 32-team seed set with ESPN identifiers where verified;
- `(external_source, external_event_id)` uniqueness;
- status, scores, kickoff, selectability, sync metadata, and override metadata;
- checks for distinct home and away teams and non-negative scores;
- a disabled/duplicate handling path that never cascades away submitted picks.

### 2.4 Line revisions and results

Implement append-only `official_lines` revisions with one current official revision per game, using a partial unique index or a separate current pointer.

Store:

- source and bookmaker metadata;
- published and overridden timestamps;
- actor and override reason;
- revision lineage or revision number.

Implement `game_results` for the current calculated/overridden ATS outcome. Preserve override reason and actor. Add historical audit snapshots through `audit_events`.

### 2.5 Entries and picks

Implement one `entries` row per member/week and five `picks` for each submitted entry.

Database-level protections should cover:

- unique entry per member/week;
- unique game per entry;
- selected side/team consistency;
- selected game belongs to entry week;
- immutable submitted line reference;
- only one active pick set through atomic replacement, not incremental public writes.

Because “exactly five rows” spans records, enforce it in the submission transaction, not with a fragile row constraint.

### 2.6 Payments and finalized snapshots

Implement `payments`, `weekly_player_results`, `weekly_financials`, and the payout-allocation structure selected in Plan 0.

Add:

- uniqueness by week/member;
- non-negative expected/received/winnings values;
- valid payment status/amount combinations;
- immutable or revisioned finalized snapshots;
- allocation sum validation during finalization.

### 2.7 Audit events

Implement append-only `audit_events` with league, actor, entity, event, reason, and JSON before/after data.

Only trusted server functions may insert sensitive audit types. Players must not be able to rewrite or delete audit records.

### 2.8 Indexing and typed contracts

Index common access patterns:

- current season/week by league;
- games by week and kickoff;
- entries and payments by week/member;
- picks by entry/game;
- audit by league and reverse chronological time;
- history/standings by finalized week.

Generate database types and add domain-level Zod schemas for boundary validation.

## Transaction/API functions to define

- `claim_league_membership`
- `publish_week`
- `submit_entry`
- `commissioner_edit_entry`
- `override_official_line`
- `override_game_score_or_result`
- `set_payment`
- `finalize_week`
- `reopen_week`

Each function must validate actor, league scope, current state, and reason requirements within the same transaction as its writes.

## Migration strategy

- One concern per migration with reversible development migrations where practical.
- Never edit an already deployed migration; add a new one.
- Seed reference teams separately from environment-specific league/player data.
- Include a local demo seed only if it cannot be confused with production seed data.

## Verification

- Constraint tests attempt invalid cross-week, cross-league, duplicate, negative, and inconsistent records.
- Transaction tests demonstrate full rollback on an invalid fifth pick or failed audit insert.
- Migration-from-empty test succeeds.
- Generated types match the migrated schema in CI.

## Exit criteria

- The schema supports every V1 record and override without destructive overwrites.
- All high-risk multi-row operations have a transaction boundary.
- Tenant ownership and RLS paths are indexable and unambiguous.
- The team can explain which records are provisional, current official, and finalized snapshots.
