"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PickGame = {
  id: string;
  kickoffAt: string;
  home: { abbreviation: string; displayName: string };
  away: { abbreviation: string; displayName: string };
  homeSpread: number;
};

type Props = {
  weekId: string;
  weekNumber: number;
  games: PickGame[];
  initialPicks: Record<string, "HOME" | "AWAY">;
  initialTiebreaker: number | null;
  tiebreakerLabel: string;
  lockAt: string;
  locked: boolean;
  commissionerEdit?: { memberId: string };
};

export function PickForm({ weekId, weekNumber, games, initialPicks, initialTiebreaker, tiebreakerLabel, lockAt, locked, commissionerEdit }: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState(initialPicks);
  const [tiebreaker, setTiebreaker] = useState(initialTiebreaker?.toString() ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editReason, setEditReason] = useState("");
  const count = Object.keys(picks).length;
  const canSubmit = (!locked || Boolean(commissionerEdit)) && count === 5 && /^\d+$/.test(tiebreaker) && Number(tiebreaker) <= 200 && (!commissionerEdit || editReason.trim().length >= 3) && !saving;
  const selectedReview = useMemo(() => games.filter((game) => picks[game.id]).map((game) => `${picks[game.id] === "HOME" ? game.home.abbreviation : game.away.abbreviation} ${formatSpread(picks[game.id] === "HOME" ? game.homeSpread : -game.homeSpread)}`), [games, picks]);

  function select(gameId: string, side: "HOME" | "AWAY") {
    if (locked && !commissionerEdit) return;
    setMessage(null);
    setPicks((current) => {
      if (current[gameId] === side) {
        const next = { ...current };
        delete next[gameId];
        return next;
      }
      if (!current[gameId] && Object.keys(current).length >= 5) {
        setMessage("You already have 5 picks. Remove one to choose another.");
        return current;
      }
      return { ...current, [gameId]: side };
    });
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);
    const response = await fetch(commissionerEdit ? "/api/admin/entry" : "/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekId, memberId: commissionerEdit?.memberId, reason: commissionerEdit ? editReason : undefined, tiebreakerPoints: Number(tiebreaker), picks: Object.entries(picks).map(([gameId, selectedSide]) => ({ gameId, selectedSide })) }),
    });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error ?? "Could not save your picks.");
    setMessage(commissionerEdit ? `Week ${weekNumber} entry updated and audited.` : `Your Week ${weekNumber} picks are submitted.`);
    router.refresh();
  }

  return (
    <>
      <div className="pick-deadline"><span>{locked ? "PICKS LOCKED" : "LOCKS"}</span><strong>{formatDeadline(lockAt)}</strong></div>
      <div className="pick-games">
        {games.map((game) => (
          <article className="pick-game" key={game.id}>
            <div className="game-time">{formatKickoff(game.kickoffAt)}</div>
            <button type="button" className={picks[game.id] === "AWAY" ? "team-option selected" : "team-option"} onClick={() => select(game.id, "AWAY")} disabled={locked && !commissionerEdit} aria-pressed={picks[game.id] === "AWAY"}>
              <span><b>{game.away.abbreviation}</b><small>{game.away.displayName}</small></span><strong>{formatSpread(-game.homeSpread)}</strong>
            </button>
            <button type="button" className={picks[game.id] === "HOME" ? "team-option selected" : "team-option"} onClick={() => select(game.id, "HOME")} disabled={locked && !commissionerEdit} aria-pressed={picks[game.id] === "HOME"}>
              <span><b>{game.home.abbreviation}</b><small>{game.home.displayName}</small></span><strong>{formatSpread(game.homeSpread)}</strong>
            </button>
          </article>
        ))}
      </div>
      {count === 5 ? (
        <section className="tiebreaker-card">
          <p className="eyebrow">MONDAY TIEBREAKER</p><h2>{tiebreakerLabel}</h2><p>Guess the combined final score of the designated game.</p>
          <input aria-label="Combined points prediction" inputMode="numeric" type="number" min="0" max="200" value={tiebreaker} onChange={(event) => setTiebreaker(event.target.value)} disabled={locked && !commissionerEdit} placeholder="47" />
          <div className="selection-review">{selectedReview.map((pick) => <span key={pick}>{pick}</span>)}</div>
        </section>
      ) : null}
      {commissionerEdit ? <label className="field commissioner-reason"><span>Commissioner edit reason</span><input value={editReason} onChange={(event) => setEditReason(event.target.value)} minLength={3} required placeholder="Explain why this entry is being changed" /></label> : null}
      {message ? <p className={message.includes("submitted") ? "form-message form-notice" : "form-message form-error"} role="status">{message}</p> : null}
      <div className="pick-footer"><strong>{count} / 5 picks</strong><button type="button" className="button button-primary" disabled={!canSubmit} onClick={submit}>{saving ? "Submitting…" : commissionerEdit ? "Save audited edit" : initialTiebreaker === null ? "Submit picks" : "Update picks"}</button></div>
    </>
  );
}

function formatSpread(value: number) { if (value === 0) return "PK"; return `${value > 0 ? "+" : ""}${value}`; }
function formatKickoff(value: string) { return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(value)); }
function formatDeadline(value: string) { return new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value)); }
