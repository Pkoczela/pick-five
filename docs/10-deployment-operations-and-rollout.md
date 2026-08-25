# Plan 10 — Deployment, Operations, and Rollout

## Outcome

Deploy a secure and supportable production app, validate it alongside the workbook, and promote it to the pool’s operational source of truth only after results match.

## Work packages

### 10.1 Environments and secrets

- Define local, preview/staging, and production environments.
- Create separate Supabase projects or a clearly isolated staging strategy.
- Configure Vercel environment variables for Supabase public URL/key and server-only service-role key.
- Restrict any odds key to server use if the optional adapter is later enabled.
- Validate allowed auth redirect URLs and production domain.
- Document secret rotation without recording secret values.

### 10.2 Database release process

- Apply migrations through a repeatable CI/release command.
- Back up production before high-risk schema or finalization changes.
- Use forward fixes rather than editing deployed migrations.
- Seed NFL reference teams independently of league/member production data.
- Document restore steps and test them using a non-production target.

### 10.3 Scheduled score refresh

- Start with a reliable commissioner `Refresh Scores` action.
- Add Vercel Cron or Supabase scheduling only after manual refresh works.
- Schedule only during useful NFL windows and keep the job idempotent.
- Authenticate scheduled invocations and cap runtime/retry behavior.
- Surface last success/failure and retain enough logs to diagnose provider issues.

### 10.4 Observability and support

Capture structured server logs for:

- provider sync attempts and failures;
- publish and submission failures without leaking picks to unauthorized logs/views;
- override/finalization transaction failures;
- scheduled-job execution;
- auth and membership-claim errors.

Add application error monitoring if available, with sensitive-data scrubbing. Write a commissioner runbook for schedule outage, postponed game, score override, exact tie, reopen, and lost access.

### 10.5 Data preparation

- Create the production league and season.
- Seed/invite current players manually and verify display names/emails.
- Configure league name, timezone, fee, privacy, and payment eligibility.
- Historical import is optional: prefer finalized weekly summaries over blocking launch for pick-level history.
- Reconcile any imported totals against the workbook before exposure.

### 10.6 Rehearsal

Before a real week:

- run a full synthetic week through setup, submission, lock, reveal, score, finalize, history, and next-week rollover;
- test commissioner exception paths;
- verify sign-in on representative player devices;
- confirm production auth email delivery and redirect behavior;
- rehearse backup and restore.

### 10.7 Parallel production rollout

For the first real week, keep the spreadsheet as an independent comparison record:

1. Compare every official spread before publish.
2. Compare all submitted selections after lock.
3. Compare final scores and ATS results.
4. Compare correct totals and tiebreaker outcome.
5. Compare contribution, payout, and rollover.
6. Record and investigate every discrepancy before declaring the week final operational evidence.

If a material scoring issue is found, run a second parallel week after correction. Do not make ad hoc production data changes without using supported audited workflows.

### 10.8 Cutover and rollback posture

Cut over when:

- acceptance gates pass;
- a real parallel week matches the workbook;
- commissioners can use the runbook;
- backups and restore are verified;
- all active players can authenticate.

After cutover, retain the spreadsheet only as historical archive. A temporary rollback means returning operational collection to the established workflow; it must not involve destructive deletion of web-app data.

## Production checklist

- Production domain and TLS work.
- Auth redirects and invitation flow work.
- RLS is enabled on every exposed table.
- Service-role key is server-only.
- Migrations and reference seeds are current.
- League settings and commissioner roles are verified.
- Provider refresh and manual fallback work.
- Audit events and finalization are visible.
- PWA metadata/icons load.
- Monitoring, backups, and runbook owners are identified.

## Exit criteria

- The group completes a matching parallel week on the production URL.
- Commissioners can diagnose or work around a provider outage without Excel-based scoring.
- Recovery procedures are written and rehearsed.
- The app becomes the source of truth only with explicit commissioner approval after reconciliation.
