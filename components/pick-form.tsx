"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/ui";

export type PickGame = {
  id: string; kickoffAt: string;
  home: { abbreviation: string; displayName: string };
  away: { abbreviation: string; displayName: string };
  homeSpread: number;
};
export type PickSubmission = { picks: Record<string, "HOME" | "AWAY">; tiebreaker: number };
type Props = {
  weekId: string; weekNumber: number; games: PickGame[];
  initialPicks: Record<string, "HOME" | "AWAY">; initialTiebreaker: number | null;
  tiebreakerLabel: string; lockAt: string; locked: boolean;
  commissionerEdit?: { memberId: string };
  onSampleSubmit?: (entry: PickSubmission) => Promise<void>;
};

export function PickForm({ weekId, weekNumber, games, initialPicks, initialTiebreaker, tiebreakerLabel, lockAt, locked, commissionerEdit, onSampleSubmit }: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState(initialPicks);
  const [tiebreaker, setTiebreaker] = useState(initialTiebreaker?.toString() ?? "");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editReason, setEditReason] = useState("");
  const signature = (p: Record<string, string>, t: string) => JSON.stringify([Object.entries(p).sort(), t]);
  const [saved, setSaved] = useState(initialTiebreaker === null ? null : signature(initialPicks, String(initialTiebreaker)));
  const count = Object.keys(picks).length;
  const readOnly = locked && !commissionerEdit;
  const validTiebreaker = /^\d+$/.test(tiebreaker) && Number(tiebreaker) <= 200;
  const dirty = saved !== signature(picks, tiebreaker);
  const canSubmit = !readOnly && count === 5 && validTiebreaker && (!commissionerEdit || editReason.trim().length >= 3) && !saving && dirty;
  const review = useMemo(() => games.filter(game => picks[game.id]).map(game => ({ id: game.id, team: picks[game.id] === "HOME" ? game.home.abbreviation : game.away.abbreviation, spread: picks[game.id] === "HOME" ? game.homeSpread : -game.homeSpread })), [games, picks]);
  const nextStep = readOnly ? "The deadline has passed. Your saved picks are locked." : !dirty ? "Your entry is saved. You can edit until lock." : count !== 5 ? `Choose ${5 - count} more ${5 - count === 1 ? "game" : "games"}.` : !validTiebreaker ? "Enter your tiebreaker to finish." : commissionerEdit && editReason.trim().length < 3 ? "Add a reason for this edit." : "Ready to submit. Review your five below.";

  function select(gameId: string, side: "HOME" | "AWAY") {
    if (readOnly || saving) return;
    setMessage(null);
    if (!picks[gameId] && count >= 5) { setMessage({ text: "You have five picks. Tap a selected team to remove it before choosing another game.", error: true }); return; }
    setPicks(current => {
      const next = { ...current };
      if (current[gameId] === side) delete next[gameId]; else next[gameId] = side;
      return next;
    });
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true); setMessage(null);
    try {
      if (onSampleSubmit) await onSampleSubmit({ picks, tiebreaker: Number(tiebreaker) });
      else {
        const response = await fetch(commissionerEdit ? "/api/admin/entry" : "/api/entries", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ weekId, memberId: commissionerEdit?.memberId, reason: commissionerEdit ? editReason : undefined, tiebreakerPoints: Number(tiebreaker), picks: Object.entries(picks).map(([gameId, selectedSide]) => ({ gameId, selectedSide })) }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "We couldn’t save your picks. Your selections are still here; please try again.");
      }
      setSaved(signature(picks, tiebreaker));
      setMessage({ text: commissionerEdit ? `Week ${weekNumber} entry updated${onSampleSubmit ? " in this sample session" : " and audited"}.` : `Your Week ${weekNumber} picks are ${onSampleSubmit ? "saved in this sample session" : "submitted"}.`, error: false });
      if (!onSampleSubmit) router.refresh();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Connection interrupted. Your selections are still here. Please retry.", error: true }); }
    finally { setSaving(false); }
  }

  return <div className="pick-workspace">
    <div className="pick-deadline"><span>{readOnly ? "PICKS LOCKED" : "WEEKLY DEADLINE"}</span><strong>{formatDate(lockAt)}</strong></div>
    <div className="pick-instructions"><span>01 <strong>Choose five games</strong></span><span>02 <strong>Predict the tiebreaker</strong></span><span>03 <strong>Submit your entry</strong></span></div>
    <div className="section-heading"><h2>Your matchups</h2><span>Official pool spreads · all times ET</span></div>
    <p className="helper-text">Tap a team to select it. Tap it again to remove it. Choose only one side per game.</p>
    <div className="pick-games">{games.map(game => <article className={`pick-game ${picks[game.id] ? "has-selection" : ""}`} key={game.id}>
      <div className="game-time"><time dateTime={game.kickoffAt}>{formatDate(game.kickoffAt)}</time>{picks[game.id] && <span>✓ Picked</span>}</div>
      <div className="matchup-options">{(["AWAY", "HOME"] as const).map(side => { const team = side === "HOME" ? game.home : game.away; const selected = picks[game.id] === side; return <button key={side} type="button" className={`team-option ${selected ? "selected" : ""}`} onClick={() => select(game.id, side)} disabled={readOnly || saving} aria-pressed={selected} aria-label={`${team.displayName}, ${side.toLowerCase()}, ${formatSpread(side === "HOME" ? game.homeSpread : -game.homeSpread)}${selected ? ", selected" : ""}`}>
        <span className="team-identity"><span className="team-code">{team.abbreviation}</span><span className="team-copy"><small>{side === "HOME" ? "HOME" : "AWAY"}</small><b>{team.displayName}</b></span></span>
        <span className="team-price"><strong>{formatSpread(side === "HOME" ? game.homeSpread : -game.homeSpread)}</strong><small>{selected ? "✓ Selected" : "Select team"}</small></span>
      </button>; })}</div>
    </article>)}</div>
    {!games.length && <Notice tone="info">There are no selectable matchups available. Check back once the official lines are ready.</Notice>}
    <section className="tiebreaker-card" id="pick-review" aria-labelledby="tiebreaker-heading">
      <p className="eyebrow">YOUR TIEBREAKER</p><h2 id="tiebreaker-heading">{tiebreakerLabel}</h2><p>Predict the combined final score. Required with your five picks.</p>
      <label className="field"><span>Combined points (0–200)</span><input className="tiebreaker-input" inputMode="numeric" type="number" min="0" max="200" step="1" value={tiebreaker} onChange={event => { setTiebreaker(event.target.value); setMessage(null); }} disabled={readOnly || saving} placeholder="e.g. 47" aria-describedby="tiebreaker-help" /></label>
      <small id="tiebreaker-help">Closest prediction breaks a tie between qualifying 5–0 entries.</small>
      <div className="review-heading"><h3>Review your five</h3><span>{count} of 5 selected</span></div>
      <div className="selection-review">{review.map(pick => <span key={pick.id}>✓ {pick.team} <strong>{formatSpread(pick.spread)}</strong></span>)}{Array.from({ length: Math.max(0, 5 - count) }, (_, i) => <span className="selection-placeholder" key={`empty-${i}`}>Pick {count + i + 1}</span>)}</div>
    </section>
    {commissionerEdit && <label className="field commissioner-reason"><span>Commissioner edit reason</span><input value={editReason} onChange={event => setEditReason(event.target.value)} minLength={3} required disabled={saving} placeholder="Explain why this entry is being changed" /></label>}
    {message && <Notice tone={message.error ? "error" : "success"}>{message.text}</Notice>}
    <div className="pick-footer"><div><strong aria-live="polite">{readOnly ? "Entry locked" : !dirty ? "✓ Entry saved" : `${count} / 5 selected`}</strong><small>{nextStep}</small></div>
      {!readOnly && (count === 5 && !validTiebreaker ? <a className="button button-primary" href="#pick-review">Add tiebreaker ↓</a> : <button type="button" className="button button-primary" disabled={!canSubmit} onClick={submit}>{saving ? "Saving…" : !dirty ? "Saved ✓" : commissionerEdit ? "Save audited edit" : saved ? "Update picks" : "Submit picks"}</button>)}
    </div>
  </div>;
}
function formatSpread(value: number) { return value === 0 ? "PK" : `${value > 0 ? "+" : ""}${value}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value)); }
