"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { formatDateTime, formatKickoff, formatSpread } from "@/lib/format";
import { saveSampleEntry } from "@/lib/preview/client";

export type PickGame = {
  id: string;
  kickoffAt: string;
  home: { abbreviation: string; displayName: string };
  away: { abbreviation: string; displayName: string };
  homeSpread: number;
};
type Side = "HOME" | "AWAY";

type Props = {
  weekId: string;
  weekNumber: number;
  games: PickGame[];
  initialPicks: Record<string, Side>;
  initialTiebreaker: number | null;
  tiebreakerLabel: string;
  lockAt: string;
  locked: boolean;
  commissionerEdit?: { memberId: string };
  /** Design preview: save to the preview cookie instead of the API. */
  sample?: boolean;
};

const signature = (picks: Record<string, string>, tiebreaker: string) => JSON.stringify([Object.entries(picks).sort(), tiebreaker]);

export function PickForm({ weekId, weekNumber, games, initialPicks, initialTiebreaker, tiebreakerLabel, lockAt, locked, commissionerEdit, sample = false }: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState(initialPicks);
  const [tiebreaker, setTiebreaker] = useState(initialTiebreaker?.toString() ?? "");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [saved, setSaved] = useState(initialTiebreaker === null ? null : signature(initialPicks, String(initialTiebreaker)));
  const statusRef = useRef<HTMLDivElement>(null);
  const tiebreakerRef = useRef<HTMLInputElement>(null);

  const count = Object.keys(picks).length;
  const readOnly = locked && !commissionerEdit;
  const validTiebreaker = /^\d+$/.test(tiebreaker) && Number(tiebreaker) <= 200;
  const dirty = saved !== signature(picks, tiebreaker);
  const needsReason = Boolean(commissionerEdit) && editReason.trim().length < 3;
  const canSubmit = !readOnly && count === 5 && validTiebreaker && !needsReason && !saving && dirty;
  const visibleGames = readOnly ? games.filter((game) => picks[game.id]) : games;
  const review = useMemo(() => games.filter((game) => picks[game.id]).map((game) => {
    const side = picks[game.id];
    return { id: game.id, team: side === "HOME" ? game.home.abbreviation : game.away.abbreviation, spread: side === "HOME" ? game.homeSpread : -game.homeSpread };
  }), [games, picks]);

  const nextStep = readOnly ? (count ? "The deadline has passed. These picks are final." : "The deadline passed without an entry.")
    : !dirty ? "Saved. You can still make changes until the deadline."
    : count !== 5 ? `Choose ${5 - count} more ${5 - count === 1 ? "game" : "games"}.`
    : !validTiebreaker ? "Enter your tiebreaker to finish."
    : needsReason ? "Add a reason for this edit."
    : "Ready. Review your five, then submit.";

  function select(gameId: string, side: Side) {
    if (readOnly || saving) return;
    if (!picks[gameId] && count >= 5) {
      setMessage({ text: "You already have five picks. Tap a picked team to remove it first.", error: true });
      return;
    }
    setMessage(null);
    setPicks((current) => {
      const next = { ...current };
      if (current[gameId] === side) delete next[gameId];
      else next[gameId] = side;
      return next;
    });
  }

  function goToTiebreaker() {
    tiebreakerRef.current?.scrollIntoView({ block: "center" });
    tiebreakerRef.current?.focus({ preventScroll: true });
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);
    try {
      if (sample) {
        await saveSampleEntry({ picks, tiebreaker: Number(tiebreaker) }, { persist: !commissionerEdit });
      } else {
        const response = await fetch(commissionerEdit ? "/api/admin/entry" : "/api/entries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ weekId, memberId: commissionerEdit?.memberId, reason: commissionerEdit ? editReason : undefined, tiebreakerPoints: Number(tiebreaker), picks: Object.entries(picks).map(([gameId, selectedSide]) => ({ gameId, selectedSide })) }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "We couldn’t save your picks. Your selections are still here, so please try again.");
      }
      setSaved(signature(picks, tiebreaker));
      setMessage({ text: commissionerEdit ? `Week ${weekNumber} entry updated and audited.` : `Your Week ${weekNumber} picks are in.`, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Connection interrupted. Your selections are still here. Please try again.", error: true });
    } finally {
      setSaving(false);
      statusRef.current?.focus();
    }
  }

  return (
    <div className="pick-workspace">
      <div className="pick-deadline"><span>{readOnly ? "Picks locked" : "Deadline"}</span><strong><time dateTime={lockAt}>{formatDateTime(lockAt)}</time></strong></div>
      {readOnly ? null : (
        <>
          <ol className="pick-steps">
            <li className={count === 5 ? "is-done" : ""}><span>1</span>Choose five games</li>
            <li className={validTiebreaker ? "is-done" : ""}><span>2</span>Predict the tiebreaker</li>
            <li className={!dirty ? "is-done" : ""}><span>3</span>Submit</li>
          </ol>
          <div className="section-heading"><h2>Matchups</h2><span>Official pool spreads · Eastern time</span></div>
          <p className="helper-text">Tap a team to pick it. Tap it again to remove it. One side per game.</p>
        </>
      )}
      <div className="pick-games">
        {visibleGames.map((game) => (
          <article className={`pick-game ${picks[game.id] ? "has-selection" : ""}`} key={game.id}>
            <div className="game-time"><time dateTime={game.kickoffAt}>{formatKickoff(game.kickoffAt)}</time>{picks[game.id] ? <span className="picked-flag"><Icon name="check" />Picked</span> : null}</div>
            <div className="matchup-options">
              {(["AWAY", "HOME"] as const).map((side) => {
                const team = side === "HOME" ? game.home : game.away;
                const selected = picks[game.id] === side;
                return (
                  <button key={side} type="button" className={`team-option ${selected ? "selected" : ""}`} onClick={() => select(game.id, side)} disabled={readOnly || saving} aria-pressed={selected}>
                    <span className="team-top"><span className="team-code">{team.abbreviation}</span><strong className="team-spread">{formatSpread(side === "HOME" ? game.homeSpread : -game.homeSpread)}</strong></span>
                    <span className="team-name">{team.displayName}</span>
                    <span className="team-side">{side === "HOME" ? "Home" : "Away"}{selected ? <span className="team-check"><Icon name="check" /></span> : null}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      {!games.length ? <p className="notice notice-info">There are no selectable matchups yet. Check back once the official lines are ready.</p> : null}
      <section className="tiebreaker-card" aria-labelledby="tiebreaker-heading">
        <p className="eyebrow">Tiebreaker</p>
        <h2 id="tiebreaker-heading">{tiebreakerLabel}</h2>
        <label className="field">
          <span>Combined final score (0–200)</span>
          <input ref={tiebreakerRef} className="tiebreaker-input" inputMode="numeric" type="number" min="0" max="200" step="1" value={tiebreaker} onChange={(event) => { setTiebreaker(event.target.value); setMessage(null); }} disabled={readOnly || saving} placeholder="47" aria-describedby="tiebreaker-help" />
          <small id="tiebreaker-help">Closest guess wins if more than one entry goes 5–0.</small>
        </label>
        <div className="review-heading"><h3>Your five</h3><span>{count} of 5</span></div>
        <ul className="selection-review">
          {review.map((pick) => <li key={pick.id}><strong>{pick.team}</strong> {formatSpread(pick.spread)}</li>)}
          {Array.from({ length: Math.max(0, 5 - count) }, (_, index) => <li className="selection-placeholder" key={`empty-${index}`}>Pick {count + index + 1}</li>)}
        </ul>
      </section>
      {commissionerEdit ? <label className="field commissioner-reason"><span>Reason for this edit</span><input value={editReason} onChange={(event) => setEditReason(event.target.value)} minLength={3} required disabled={saving} placeholder="Explain why this entry is being changed" /></label> : null}
      <div className={`pick-footer ${message?.error ? "has-error" : ""}`}>
        <div ref={statusRef} tabIndex={-1} className="pick-status" role="status" aria-live="polite">
          <strong>{readOnly ? "Entry locked" : !dirty ? "Entry saved" : `${count} / 5 picked`}</strong>
          <small>{message?.text ?? nextStep}</small>
        </div>
        {readOnly ? null : count === 5 && !validTiebreaker
          ? <button type="button" className="button button-primary" onClick={goToTiebreaker}>Add tiebreaker</button>
          : <button type="button" className="button button-primary" disabled={!canSubmit} onClick={submit}>{saving ? "Saving…" : !dirty ? <><Icon name="check" />Saved</> : commissionerEdit ? "Save edit" : saved ? "Update picks" : "Submit picks"}</button>}
      </div>
    </div>
  );
}
