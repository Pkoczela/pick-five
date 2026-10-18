"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveData } from "@/components/views/live-view";
import { retainLiveScores } from "@/lib/domain/retain-live-scores";

export function useLiveUpdates(initial: LiveData) {
  const [data, setData] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(0);
  const trigger = useRef<() => void>(() => {});
  const enabled = Boolean(initial.feed || initial.poll);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let terminal = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (stopped || terminal || controller || document.visibilityState !== "visible") return;
      clearTimeout(timer);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20_000);
      setLoading(true);
      try {
        const response = await fetch(`/api/live/${encodeURIComponent(initial.week.id)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (stopped) return;
        if (response.redirected || [401, 403, 404].includes(response.status)) {
          terminal = true; setDenied(true); return;
        }
        if (!response.ok) throw new Error("Score update failed");
        const next = await response.json() as LiveData;
        if (next.week?.id !== initial.week.id || !Array.isArray(next.entries)) throw new Error("Invalid score response");
        if (stopped) return;
        terminal = (!next.feed && !next.poll) || next.week.final;
        setData(previous => retainLiveScores(previous, next));
        setFailed(false);
        setNow(Date.now());
      } catch { if (!stopped) setFailed(true); }
      finally {
        clearTimeout(timeout); controller = null;
        if (!stopped) { setLoading(false); if (!terminal) timer = setTimeout(refresh, 30_000); }
      }
    }
    trigger.current = () => { void refresh(); };
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    timer = setTimeout(refresh, 30_000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); clearInterval(clock); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); trigger.current = () => {}; };
  }, [enabled, initial.week.id]);
  const age = data.feed?.observedAt && now ? Math.max(0, Math.floor((now - Date.parse(data.feed.observedAt)) / 1000)) : null;
  return { data, denied, loading, failed: failed || data.feed?.status !== "fresh" || (age !== null && age > 90), age, refresh: useCallback(() => trigger.current(), []) };
}
