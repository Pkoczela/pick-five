"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { clearPreviewState, writePreviewState } from "@/lib/preview/client";
import { previewScenarios, type PreviewScenario, type PreviewState } from "@/lib/preview/state";

/**
 * Design-preview controls. Renders the real app with sample data; switching
 * scenario rewrites the preview cookie and re-renders the server components.
 */
export function PreviewToolbar({ state }: { state: PreviewState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function update(patch: Partial<PreviewState>) {
    writePreviewState(patch);
    startTransition(() => router.refresh());
  }

  // Server forms post to /api/*, which the preview blocks. Explain instead of showing a 403 page.
  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const action = new URL(form.action, location.href);
      if (!action.pathname.startsWith("/api/")) return;
      event.preventDefault();
      const label = (event.submitter?.textContent ?? "This action").trim();
      setToast(`“${label}” would save to the league database. Server actions are disabled in the design preview.`);
    };
    document.addEventListener("submit", onSubmit);
    return () => document.removeEventListener("submit", onSubmit);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <div className="preview-toolbar" aria-busy={pending}>
        <p><span className="preview-dot" aria-hidden="true" /><strong>Design preview</strong><span className="preview-explanation">Sample league · nothing is saved</span></p>
        <button type="button" className="preview-expand" aria-expanded={expanded} aria-controls="preview-controls" onClick={() => setExpanded(!expanded)}>
          {state.scenario} · {state.role === "OWNER" ? "Commissioner" : "Player"}
        </button>
        <div className={`preview-controls ${expanded ? "is-open" : ""}`} id="preview-controls">
          <label>Scenario
            <select value={state.scenario} onChange={(event) => update({ scenario: event.target.value as PreviewScenario, entry: null })}>
              {previewScenarios.map((scenario) => <option key={scenario}>{scenario}</option>)}
            </select>
          </label>
          <label>Role
            <select value={state.role} onChange={(event) => update({ role: event.target.value as PreviewState["role"] })}>
              <option value="OWNER">Commissioner</option>
              <option value="PLAYER">Player</option>
            </select>
          </label>
          <label className="preview-check"><input type="checkbox" checked={state.failSaves} onChange={(event) => update({ failSaves: event.target.checked })} />Fail saves</label>
          <button type="button" onClick={() => { clearPreviewState(); startTransition(() => router.refresh()); }}>Reset</button>
        </div>
      </div>
      {toast ? <div className="preview-toast" role="status"><span>{toast}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss">×</button></div> : null}
    </>
  );
}
