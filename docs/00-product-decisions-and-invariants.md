# Plan 0 — Product Decisions and Invariants

## Outcome

Turn the product specification into unambiguous rules and contracts before implementation begins. This is a short decision phase, not a design expansion exercise.

## Non-negotiable invariants

- A valid submitted entry contains exactly five distinct games, one side per game, and a non-negative integer tiebreaker.
- All entry validation and the deadline use server time and execute atomically.
- Published official lines never change from a provider sync. Only an explicit commissioner override can change them.
- A push earns no correct pick. Four correct plus one push is not 5–0.
- A jackpot is paid only for a 5–0 outcome or an explicit audited commissioner resolution.
- Exact tiebreaker-error ties are never broken automatically.
- Before the deadline, a member can read only their own pick details. Submission metadata may be shared.
- After the deadline, submitted picks are visible to active league members.
- Payment state and entry validity are separate unless the league configuration explicitly says unpaid entries are ineligible.
- Money is stored as integer cents; finalized financial records are snapshots.
- Provider data is advisory. Frozen lines, overrides, and finalized records are internal sources of truth.
- Every fairness- or money-affecting override records actor, reason, before state, after state, and timestamp.

## Decisions to close before schema freeze

### D1. Effective lock and stored week state

Decided: retain a stored workflow status but derive an `effective_status` that treats an `OPEN` week with `now >= lock_at` as locked. Publishing calculates `lock_at` as exactly five minutes before the earliest selectable kickoff and freezes that timestamp. Later ESPN schedule changes do not move it. Database write functions check both stored status and server time; correctness never depends on a scheduled job.

Acceptance:

- a player write fails at or after `lock_at` even if the stored status is still `OPEN`;
- post-lock reads reveal entries based on server time, without waiting for a cron job.

### D2. What must be final before result review

Recommended decision: result review becomes available when every game referenced by a submitted pick plus the designated tiebreaker game is `FINAL` or explicitly `VOID`. Unselected games should not block the pool.

### D3. Published line override semantics

The specification requires both preserving the line referenced at submission and re-scoring with the final official line after an override.

Recommended decision:

- `picks.submitted_official_line_id` remains immutable for audit;
- each game has one current official line revision used by scoring;
- an override inserts a new revision, never overwrites the old row;
- affected picks are re-scored against the current official revision;
- the result view shows that the scoring line differs from the submitted line.

This avoids overloading one foreign key with two meanings.

### D4. Unpaid-entry eligibility

Decided: the owner selects whether unpaid entries are eligible for each week, and that policy freezes at publish so it cannot change after entries or results are known.

### D5. Commissioner pre-lock pick access

Decided: picks remain hidden in normal commissioner views. An explicit `View/Edit Entry` exception action may reveal them before lock and must be audited; every edit requires a reason.

### D6. Manual winner and split representation

Recommended decision: allow one or more payout allocations in a dedicated table rather than encoding every outcome in a single winner flag. Validate that allocation totals equal the finalized payout unless a separate audited jackpot adjustment is recorded.

### D7. Reopening a final week

Decided: use an explicit `REOPENED` state. When a correction changes rollover already used by finalized later weeks, guide the commissioner through reviewing and re-finalizing every affected downstream week in sequence. This may revise a settled payout and therefore requires explicit per-week confirmation and a complete audit trail.

### D8. Postponed and disabled games

Recommended decision: add commissioner-controlled `is_selectable` and `disabled_reason` fields to games. Disabling a game with submitted picks must be blocked or routed through a documented VOID/entry-resolution workflow.

### D9. League membership claim flow

Decided: every league has one reusable invitation code. A person enters the active code, chooses a display name, globally unique username, and password, and immediately becomes a player in that league. Returning players sign in with username and password. The code is bearer-authorized, may be reused by multiple people, and can be rotated or disabled by the owner without affecting existing members.

### D10. Rollover dependencies across weeks

Decided: a later week may be prepared in draft, but cannot publish/open until the previous pool week is final and its rollover is authoritative.

## Configuration contract

V1 configuration should include:

- league name and IANA timezone;
- default entry fee in cents;
- commissioner pre-lock pick visibility;
- unpaid-entry eligibility;
- week-specific lock timestamp, contribution override, and tiebreaker game;
- optional odds bookmaker/source only when the odds adapter is enabled.

Configuration changes that can affect an open or finalized week must be audited.

## Outputs

- Resolved answers for D1–D10.
- Domain glossary for `participant`, `submitted entry`, `eligible entry`, `official line`, `scoring line`, `jackpot`, `contribution`, `payout`, and `rollover`.
- Architecture decision records for any choice that differs from the recommendations above.
- A rule-to-test mapping carried into Plan 9.

## Exit criteria

- No unresolved decision changes a database primary relationship, finalization rule, privacy policy, or payout result.
- Commissioner and player behavior can be expressed without relying on UI-only enforcement.
- The team agrees that new game rules require an explicit product decision rather than an implementation guess.
