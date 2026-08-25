# Plan 9 — Verification and Acceptance

## Outcome

Create layered evidence that Pick Five implements the rules exactly, protects pre-lock picks, survives provider and concurrency failures, and can replace the spreadsheet for a real week.

## Test strategy

### Layer 1 — Pure unit tests

Fast, table-driven tests for:

- ATS calculation;
- pick scoring;
- five-correct eligibility;
- tiebreaker resolution;
- contribution, payout, rollover, and splits;
- display-only alive/eliminated state;
- boundary validation and time helpers.

These tests must have no database, network, or framework dependency.

### Layer 2 — Database and RLS tests

Run against a migrated local Supabase/Postgres database:

- constraints and tenant isolation;
- pre/post-lock read policy;
- player versus commissioner mutations;
- membership claim behavior;
- atomic entry replacement;
- publish, override, finalization, and reopen transactions;
- audit-event requirements;
- concurrency/idempotency scenarios.

Tests should use real role claims rather than an all-powerful database user for policy assertions.

### Layer 3 — Provider contract tests

- Parse committed ESPN response fixtures.
- Cover scheduled, active, halftime, final, postponed, canceled, missing fields, duplicate-like events, and malformed responses.
- Mock timeout, transient retry, permanent failure, and partial response behavior.
- Prove internal code consumes normalized provider contracts, not provider JSON.

Do not make ordinary CI depend on the live ESPN endpoint.

### Layer 4 — Application integration tests

- Server actions/routes enforce authentication, league scope, deadline, and validation.
- Transaction failures preserve prior valid data.
- Score refresh leads to expected ATS and pick results.
- Finalization creates balanced snapshots and correct state transitions.
- Cache invalidation/revalidation does not leak pre-lock data.

### Layer 5 — Browser end-to-end tests

Automate the critical paths at desktop and mobile viewports with seeded users:

- commissioner setup/publish;
- player submit/edit;
- privacy before lock and reveal after lock;
- score refresh/result display;
- normal finalization, rollover, tiebreaker, and exact-tie resolution;
- standings/history/payment visibility;
- critical error and permission states.

Use controllable server time or seeded deadlines; do not make tests wait for wall-clock deadlines.

## Required rule matrix

| Area | Required cases |
| --- | --- |
| ATS | Favorite covers/fails, underdog covers, exact push, pick’em home/away |
| Pick | Correct/incorrect HOME and AWAY, push, void |
| Entry | Exactly 5 accepted; 4/6, duplicate, wrong week, missing tiebreaker, post-lock rejected |
| Tiebreaker | Exact, over, under, closest, equal absolute error |
| Financial | Winner with/without rollover, no winner, override, zero participants, split |
| State | Draft rejection, open acceptance, effective lock, final authorization, reopen audit |
| Privacy | Own-only before lock; all submitted after lock; direct API/database checks |

## Acceptance scenarios

### A. Normal winner

Publish a complete week, submit ten valid entries, finalize scores with one 5–0 player, and finalize the week. Verify the entire jackpot is allocated, rollover out is zero, history and standings update, and no manual scoring occurs.

### B. Rollover

With a $170 final contribution and no 5–0 entry, verify payout $0 and rollover out $170. Create the next week and verify its authoritative rollover in becomes $170 only from the finalized prior week.

### C. Multiple 5–0 players

With actual tiebreaker total 51 and guesses 49 and 55, verify errors 2 and 4 and the first player wins.

### D. Exact tiebreak tie

With actual 50 and guesses 48 and 52, verify state `TIE_REQUIRES_COMMISSIONER`, no automatic winner, and an audited manual resolution is required.

### E. Push

Force an exact adjusted-score push. Verify pick `PUSH`, no correct increment, no normal 5–0, and correct display.

### F. Privacy

Before lock, verify Player B can see that Player A submitted but cannot retrieve A’s selections or tiebreaker through UI, server route, or direct permitted database query. After effective lock, verify access succeeds.

### G. Corrections

Finalize a week, reopen it, change a result with a reason, re-score, review changed finances, and re-finalize. Verify a complete audit chain and no silent stale later-week rollover.

### H. Provider outage

Simulate ESPN timeout/partial data. Verify stored schedule remains, commissioner sees an actionable error, retries are bounded, overrides remain, and manual fallback is possible.

## Non-functional gates

- Type check, lint, unit, database, and integration suites pass in CI.
- Critical browser suite passes on the production-shaped build.
- No known high-severity authorization/privacy defect.
- No horizontal scrolling in core phone flows.
- Core pages pass automated accessibility checks with manual keyboard review.
- A backup/restore rehearsal succeeds before production rollout.

## Traceability requirement

Every pull request should cite the plan section and tests it satisfies. Maintain a release checklist mapping all V1 definition-of-done bullets to automated tests or a named manual verification step.

## Exit criteria

- Scenarios A–H pass with captured results.
- The commissioner can run a full seeded rehearsal without database intervention.
- Test failures clearly distinguish business-rule, authorization, provider, and UI regressions.
- Known limitations are documented and do not contradict V1 rules.
