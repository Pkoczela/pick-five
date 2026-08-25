# Plan 5 — Live Scoring and Pool Board

## Outcome

After lock, league members can see every submitted entry and follow correct, incorrect, pending, push, and void results. Final scores and ATS outcomes are computed against frozen official lines without manual Excel work.

## Work packages

### 5.1 Pure scoring domain

Create dependency-free TypeScript functions for:

- ATS result from home score, away score, and home spread;
- pick result from selected side and ATS result;
- entry counts and 5–0 eligibility;
- alive/eliminated display state;
- readiness for winner resolution.

Use precise spread representation so floating-point behavior cannot manufacture a push. If database spreads are decimal strings, normalize them deliberately at the boundary.

### 5.2 Score refresh

- Reuse the ESPN provider boundary.
- Support commissioner-triggered refresh in all environments.
- Optionally schedule refresh every 5–10 minutes during active windows.
- Upsert normalized status and scores idempotently.
- Preserve manual score/result overrides.
- Do not permanently settle ATS results until a game is final or explicitly overridden/voided.
- Record sync time and show stale/error state to commissioners.

### 5.3 ATS and pick recomputation

- Calculate `HOME`, `AWAY`, or `PUSH` from final scores and the current official line revision.
- Map canceled/manual cases to `VOID` and unfinished games to `PENDING`.
- Recompute all dependent picks after a final score or audited line/result change.
- Treat push and void separately from incorrect for display, but never as correct.
- Keep provisional computed records distinct from final weekly snapshots.

### 5.4 Pool board

Before lock, show counts only. After lock, default to player cards on mobile:

- player and `correct / pending` summary;
- each selected team and submitted/current scoring line context;
- correct, incorrect, pending, push, or void status;
- tiebreaker prediction;
- `Still alive for 5–0` only when no completed pick is incorrect/push/void and enough unresolved picks remain.

Offer a desktop grid only after the card view is complete and accessible.

### 5.5 Result overrides

- Commissioner can override a score, game status, ATS result, or void state.
- Require reason and confirmation with affected-entry count.
- Preserve provider values and the previous internal value for audit.
- Re-score dependent entries immediately.
- If the week is final, force the reopen-and-review workflow rather than silently altering snapshots.

### 5.6 Final-readiness transition

When all games referenced by submitted entries plus the tiebreaker game are final or void:

- compute each entry’s provisional totals;
- transition to `AWAITING_FINAL`, unless an exact tiebreaker tie later requires the dedicated state;
- present unresolved void/override conditions prominently to the commissioner.

The transition must be idempotent and safe if two refreshes finish concurrently.

## Unit tests

ATS:

- favorite covers and fails to cover;
- underdog covers;
- exact push;
- pick’em home and away wins;
- representative half-point and whole-point lines.

Pick/entry:

- correct/incorrect HOME and AWAY;
- push and void;
- five correct;
- four correct plus push;
- alive with pending picks;
- eliminated by incorrect, push, or void under normal rules.

## Integration tests

- A scheduled game remains pending even if a provider exposes zero scores.
- Only final status settles the normal ATS result.
- Refresh never overwrites an override.
- A published line override re-scores entries but retains submitted-line traceability.
- Post-lock access reveals entries; pre-lock access does not.
- Concurrent refreshes do not create duplicate result records or invalid state transitions.

## Exit criteria

- Sunday scoring requires no manual workbook entry.
- Every displayed result can be traced to final score, official scoring line, and any override.
- Members can follow the pool comfortably on mobile after lock.
- Commissioner corrections are explicit, reversible through a new correction, and audited.
