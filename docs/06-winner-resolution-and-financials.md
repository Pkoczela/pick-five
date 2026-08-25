# Plan 6 — Winner Resolution and Financials

## Outcome

The system deterministically identifies 5–0 candidates, applies the Monday-game absolute-error tiebreaker, routes exact ties to a commissioner, and finalizes a balanced payout/rollover snapshot.

## Work packages

### 6.1 Pure winner-resolution engine

Input only explicit data: eligible entry results, tiebreaker predictions, actual designated-game total, and configured eligibility rules.

Return one of:

- sole 5–0 winner;
- closest-tiebreaker winner;
- no 5–0 winner;
- exact tie requiring commissioner;
- not ready because required data is unresolved.

Rules:

- candidate means `correct_count === 5`;
- error is `abs(prediction - actual_total)`;
- the unique lowest error wins;
- equal lowest errors never select arbitrarily.

### 6.2 Contribution and rollover engine

Pure inputs:

- participating/eligible entry count as decided in Plan 0;
- default fee;
- optional contribution override;
- finalized prior-week rollover;
- winner/no-winner/manual resolution.

Calculations:

- `calculated_contribution = participating_entries × default_entry_fee`;
- `final_contribution = override ?? calculated_contribution`;
- available jackpot is rollover in plus final contribution;
- a winner payout consumes the jackpot and sets rollover out to zero;
- no winner pays zero and carries the available jackpot forward.

Reject negative values and unsafe integer overflow. Never derive a current week’s authoritative rollover from an unfinalized prior week.

### 6.3 Result review screen

Show commissioners:

- final/void state, score, official spread, and ATS result for each relevant game;
- every submitted entry’s counts and tiebreaker details;
- payment/eligibility warnings;
- calculated contribution and any override;
- rollover in, available jackpot, proposed payout, and rollover out;
- the provisional resolution with an explanation.

Finalization must require an explicit confirmation.

### 6.4 Exact tie and manual resolution

When tied:

- set `TIE_REQUIRES_COMMISSIONER`;
- allow selecting a winner, splitting payout, or recording another manual resolution;
- require a note and one or more payout allocations;
- ensure allocations sum to payout;
- prohibit payout beyond the available jackpot unless an explicit audited financial adjustment is entered.

Do not label a manually selected winner as an automatic tiebreaker winner.

### 6.5 Finalization transaction

Within one commissioner-authorized transaction:

1. Lock the week and financial dependency rows.
2. Re-validate that all relevant games and tiebreaker inputs are resolved.
3. Recompute player results and the resolution from source data.
4. Confirm the previous relevant week is final and copy its rollover out.
5. Calculate or validate contribution, payout, allocations, and rollover out.
6. Write player-result and financial snapshots.
7. Set final timestamps/actor and transition to `FINAL`.
8. Write audit events for manual or overridden values.

Rollback everything on any mismatch. Repeated identical requests must not double-pay or duplicate snapshots.

### 6.6 Reopen and correction

- Require commissioner, reason, and confirmation.
- Record the final snapshot being reopened.
- Block or flag later financial dependencies.
- Re-score after corrections and require full result review again.
- Re-finalize with a new audit trail; never silently mutate history.

## Unit tests

Winner/tiebreaker:

- no 5–0 candidates;
- exactly one candidate;
- closest over and under prediction;
- exact prediction;
- equal absolute-error tie;
- unresolved actual total;
- push/void prevents normal 5–0.

Financials:

- no rollover plus winner;
- rollover plus winner;
- rollover plus no winner;
- contribution override, including zero;
- no participants;
- valid and invalid split payout;
- payout exceeding jackpot;
- safe integer boundaries.

## Integration tests

- Finalization cannot run early or by a player.
- Concurrent finalization produces one snapshot.
- Exact tie requires manual input and reason.
- Next week receives only finalized rollover out.
- Reopening a prior week identifies or blocks affected later-week financials.
- Individual winnings sum to total payout.

## Exit criteria

- Normal winner, rollover, tiebreaker winner, and exact-tie scenarios match the source specification.
- Every finalized dollar is explainable by integer-cent inputs and balanced allocations.
- Final records are stable until an explicit audited reopen.
- No manual arithmetic is needed for normal weekly operation.
