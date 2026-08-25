# Plan 4 — Player Entry and Lock Privacy

## Outcome

An invited player can understand the current week, choose exactly five ATS sides, enter the tiebreaker, and safely submit or edit from a phone before the deadline. Other members cannot see the selections before lock.

## Work packages

### 4.1 Current-week home

Show:

- league and NFL week;
- current/provisional jackpot;
- week state and explicit local-time deadline;
- own entry state and submission timestamp;
- own payment indicator;
- aggregate submitted count, never pre-lock pick detail;
- a primary action appropriate to draft/open/locked/final state.

Handle no active season, no published week, closed week, inactive membership, and provider/setup errors without dead ends.

### 4.2 Pick Five interaction

- Render mobile game cards ordered by kickoff.
- Show away/home name, abbreviation, and opposite signed spreads.
- Make each team row a full accessible tap target.
- Selecting the other side of the same game replaces the side.
- Block a sixth distinct game and explain how to continue.
- Keep a sticky `X / 5` counter and action area.
- Preserve unsaved local selections through normal navigation where safe, while making clear what is and is not submitted.

### 4.3 Tiebreaker and review

- Reveal or enable the tiebreaker step when five games are selected.
- Accept only a non-negative integer within a defensible maximum configured in validation.
- Show the designated matchup and simple combined-score explanation.
- Present a confirmation summary containing five teams, five frozen display lines, tiebreaker, and deadline.

### 4.4 Atomic submission

Implement submission through one server/database transaction:

1. Authenticate the active league member.
2. Load and lock the week/entry records as needed.
3. Confirm stored state permits entries and server time is before `lock_at`.
4. Validate five unique week games and one valid side/team per game.
5. Confirm every game is selectable and has a current official line.
6. Validate the tiebreaker.
7. Replace the active pick set atomically.
8. Set server-generated `submitted_at` and status.

If any check fails, keep the previous valid submission unchanged.

### 4.5 Editing and race behavior

- Load the player’s submitted picks and permit normal edits before lock.
- Re-submit all five as a replacement set.
- Detect stale line/week changes and require the player to review before retrying.
- Disable duplicate client requests, while maintaining idempotency on the server.
- If the deadline passes while the page is open, reject the write safely and move to locked view.

### 4.6 Privacy and read policies

Before effective lock:

- players can read their own entry and picks;
- members can read only other members’ submitted/not-submitted metadata;
- tiebreaker predictions follow pick-detail privacy;
- commissioners get metadata by default, with configured explicit access to details.

After effective lock:

- active league members can read all submitted entries and picks for that week;
- draft or void entries are not exposed as normal submissions;
- database/RLS policy, not client routing, controls the transition.

### 4.7 Commissioner exception edit

- Place the action behind a secondary admin flow.
- Require an explanation for every after-lock edit and any pre-lock edit of another member’s entry.
- Reuse the same structural validation as player submission.
- Mark the entry commissioner-edited and write a detailed audit event.
- Never impersonate the player or falsify `submitted_at`.

## Validation matrix

Accept only:

- five distinct games from this week;
- one HOME/AWAY side whose team matches the game;
- five available official lines;
- a valid tiebreaker;
- an active member and an open, pre-deadline week.

Reject four or six picks, duplicate games, foreign-week games, disabled games, missing/stale lines, invalid sides, missing tiebreaker, client timestamps, inactive members, and post-lock writes.

## Tests and acceptance evidence

- Transaction and RLS tests cover all validation-matrix failures.
- A failed re-submit leaves the prior five picks intact.
- Two rapid submissions result in one internally consistent active set.
- Player B cannot query Player A’s picks or tiebreaker before lock through direct database/API access.
- The same query becomes allowed after effective lock.
- The core flow works at a 320–390 px viewport without horizontal scrolling.

## Exit criteria

- Every active player can submit without texting a commissioner.
- A player always knows whether picks are draft, submitted, or locked.
- Deadline and privacy guarantees hold when the client clock is wrong and when no scheduled lock job has run.
- Exceptional commissioner edits are visible and auditable.
