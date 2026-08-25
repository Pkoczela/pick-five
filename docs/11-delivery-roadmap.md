# Plan 11 — Delivery Roadmap

## Outcome

Sequence implementation into reviewable vertical milestones with explicit dependencies and release gates. Estimates should be added only after the team and delivery capacity are known.

## Milestone map

### M0 — Decisions and engineering baseline

Plans: 0 and the setup portions of 1.

Deliver:

- decisions D1–D10;
- repository/tooling scaffold;
- test/CI commands;
- local Supabase workflow;
- environment documentation.

Gate: no open decision can force a destructive schema rewrite of entries, lines, finalization, or membership.

### M1 — Secure league access

Plans: 1 and identity portions of 2.

Deliver:

- migrations for profiles, league, membership, season;
- invitation claim and email authentication;
- role-aware shell;
- base RLS and tenant-isolation tests.

Demo: invited commissioner and player sign in; uninvited and cross-league access fail.

### M2 — Commissioner publishes a week

Plans: remaining 2 and 3.

Deliver:

- week/game/line domain;
- ESPN schedule adapter and idempotent import;
- manual schedule fallback;
- spread manager and tiebreaker selection;
- atomic publish validation.

Demo: commissioner imports a real fixture, enters lines, and publishes without Excel.

### M3 — Players submit securely

Plan: 4.

Deliver:

- current-week home;
- mobile Pick Five interaction;
- tiebreaker/review;
- atomic submit/edit;
- effective lock and RLS privacy;
- commissioner exception edit.

Demo: two players submit; direct attempts to reveal one another’s picks fail before lock and succeed after lock.

### M4 — Pool scores live

Plan: 5.

Deliver:

- pure ATS/pick engine;
- score refresh and normalized results;
- mobile pool board;
- override/recompute workflow;
- result-readiness transition.

Demo: fixture scores update a locked week and the pool board matches hand calculations.

### M5 — Winner and jackpot finalize

Plan: 6.

Deliver:

- 5–0 and tiebreaker engine;
- financial engine;
- result review;
- automatic, tie/manual, and split resolutions;
- atomic finalize/reopen.

Demo: normal winner, rollover, closest tiebreaker, and exact-tie fixtures all produce expected state and money.

### M6 — Workbook summary replacement

Plan: 7.

Deliver:

- payments and submission lists;
- final week results/history;
- standings;
- member management;
- commissioner-readable audit log.

Demo: commissioner answers all summary, payment, history, and audit questions without the workbook.

### M7 — Production hardening

Plans: 8, 9, and deployment preparation in 10.

Deliver:

- responsive/accessibility pass;
- complete resilience states;
- PWA metadata;
- full automated suite and acceptance matrix;
- operations runbook, monitoring, backup, and staging rehearsal.

Gate: all non-functional gates and acceptance Scenarios A–H pass.

### M8 — Parallel live week and cutover

Plan: rollout portion of 10.

Deliver:

- production player onboarding;
- one reconciled live week in parallel with Excel;
- discrepancy report and fixes;
- second parallel week if material scoring defects occurred;
- explicit cutover decision.

Gate: production results, tiebreaker, and money match the independent workbook comparison.

### M9 — Optional odds prefill

Start only after the cutover gate and core stability.

Deliver:

- provider adapter and team mapping;
- candidate line display with bookmaker/source/timestamp;
- commissioner review and `Use These Lines` action;
- proof that published official lines never auto-update.

## Recommended issue slicing

Keep most pull requests to one independently testable concern. Good slices include a migration plus its policy tests, a pure scoring module plus unit tests, one transaction plus integration tests, or one complete mobile screen state. Avoid a single pull request that combines schema, every UI screen, provider integration, and finalization.

Every issue should specify:

- user or system outcome;
- in-scope and explicitly out-of-scope behavior;
- dependencies and migration impact;
- authorization boundary;
- acceptance tests;
- audit/logging impact;
- rollout or backward-compatibility concern.

## Critical dependency path

`decisions → identity/RLS → schema/transactions → week publish → secure entry → scoring → finalization → history/standings → production acceptance`

UI polish, provider fixture work, and operational documentation can proceed alongside later feature work, but none should bypass the dependency gates above.

## Risk register

| Risk | Early mitigation | Release evidence |
| --- | --- | --- |
| Pre-lock pick leak | RLS-first design and direct database tests | Privacy Scenario F |
| Deadline race | Server time and atomic transaction | Boundary/concurrency tests |
| Published line ambiguity | Append-only revisions and dual submitted/scoring trace | Override integration test |
| Provider instability | Adapter, fixtures, timeout, manual fallback | Provider outage Scenario H |
| Incorrect payout | Pure integer-cent engine and atomic snapshots | Scenarios A–D plus financial tests |
| Reopen corrupts rollover | Dependency check and revision audit | Correction Scenario G |
| Mobile flow frustrates players | Early phone-width demos every milestone | M3 and M7 device checks |
| Scope expansion | Non-goals and optional odds gate | Core acceptance before M9 |

## V1 release gate

V1 is release-complete only when:

- a commissioner can operate setup through finalization without database intervention;
- players submit and follow results from phones;
- privacy and role boundaries pass direct backend tests;
- scoring, tiebreaker, and financial rules pass the required matrix;
- corrections and money-sensitive actions are audited;
- standings/history/payments replace the workbook summary;
- the first live parallel week reconciles, with a second if material scoring defects were found.
