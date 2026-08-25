# Pick Five V1 Implementation Plans

This folder converts the V1 product specification into bounded, buildable workstreams. The plans are ordered by dependency and are intended to be used as the working source for implementation, review, and acceptance.

The governing product rule remains: V1 is complete when the pool can run a real NFL week without Excel for any operational step.

## Plan index

| Order | Plan | Primary outcome | Depends on |
| --- | --- | --- | --- |
| 0 | [Product decisions and invariants](./00-product-decisions-and-invariants.md) | Ambiguities are resolved before schema and API contracts harden | None |
| 1 | [Foundation, authentication, and authorization](./01-foundation-auth-and-authorization.md) | A deployable app shell with league-scoped identity and tested access control | Plan 0 |
| 2 | [Database and domain model](./02-database-and-domain-model.md) | Versioned schema, constraints, transactions, seeds, and typed domain contracts | Plans 0–1 |
| 3 | [Commissioner week setup and providers](./03-week-setup-and-providers.md) | A commissioner can create and publish a complete week | Plans 1–2 |
| 4 | [Player entry and lock privacy](./04-player-entry-and-lock-privacy.md) | Players can safely submit exactly five picks from a phone | Plans 1–3 |
| 5 | [Live scoring and pool board](./05-live-scoring-and-pool-board.md) | Post-lock picks reveal and score automatically | Plans 2–4 |
| 6 | [Winner resolution and financials](./06-winner-resolution-and-financials.md) | Winners, ties, payouts, and rollover are finalized deterministically | Plan 5 |
| 7 | [Standings, history, payments, and audit](./07-standings-history-payments-audit.md) | The workbook summary and operational tracking are replaced | Plan 6 |
| 8 | [Experience, accessibility, and PWA](./08-experience-accessibility-and-pwa.md) | The complete player and commissioner experience is production-ready on phones | Plans 3–7 |
| 9 | [Verification and acceptance](./09-verification-and-acceptance.md) | Automated and manual evidence proves the rules, privacy, and workflows | All feature plans |
| 10 | [Deployment, operations, and rollout](./10-deployment-operations-and-rollout.md) | Production is observable, recoverable, and validated in parallel with Excel | Plans 1–9 |
| 11 | [Delivery roadmap](./11-delivery-roadmap.md) | Work is divided into reviewable milestones with gates and sequencing | All plans |

## How to use these plans

1. Resolve every blocking item in Plan 0 and record the chosen answer in that file or an ADR.
2. Deliver milestones in the order in Plan 11. A later UI may be prototyped early, but security, scoring, and financial dependencies must not be bypassed.
3. For each workstream, create issues from its work packages. Each issue should include the listed acceptance evidence.
4. Treat tests as part of the work package, not as a cleanup phase.
5. Keep third-party adapters replaceable and commissioner overrides explicit and audited.

## Global definition of done

A work package is done only when:

- its behavior is enforced on the server or database where trust matters;
- unit/integration tests cover its rules and failure paths;
- mobile behavior is verified at a narrow iPhone-sized viewport;
- loading, empty, error, and retry states are present;
- commissioner actions affecting fairness or money create audit events;
- user-facing time includes a timezone and money uses integer cents;
- documentation and environment-variable examples are current;
- no V2 feature is required for the package to work.

## Scope guard

Keep these outside V1: public leagues, subscriptions, payment processing, native apps, push campaigns, chat, custom rules, other sports, betting advice, play-by-play, and line-movement charts. Odds prefill remains optional and follows core stability.
