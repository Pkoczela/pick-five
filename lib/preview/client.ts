"use client";

import { PREVIEW_COOKIE, defaultPreviewState, parsePreviewState, serializePreviewState, type PreviewState } from "@/lib/preview/state";

export function readPreviewState() {
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${PREVIEW_COOKIE}=`))?.slice(PREVIEW_COOKIE.length + 1);
  return parsePreviewState(raw);
}

export function writePreviewState(patch: Partial<PreviewState>) {
  const current = readPreviewState();
  const next = { ...current, ...patch, formRevision: patch.scenario !== undefined ? current.formRevision + 1 : current.formRevision };
  document.cookie = `${PREVIEW_COOKIE}=${serializePreviewState(next)}; path=/; samesite=lax`;
  return next;
}

export function clearPreviewState() {
  writePreviewState(defaultPreviewState);
}

/** Stands in for POST /api/entries while previewing. */
export async function saveSampleEntry(entry: PreviewState["entry"], { persist }: { persist: boolean }) {
  const revision = readPreviewState().formRevision;
  await new Promise((resolve) => setTimeout(resolve, 400));
  // A pending save must not restore an entry after Reset or a scenario switch.
  if (readPreviewState().formRevision !== revision) throw new Error("Preview changed. This sample save was cancelled.");
  if (readPreviewState().failSaves) throw new Error("Sample connection interrupted. Your selections are still here. Turn off “Fail saves” in the preview bar and try again.");
  if (persist) writePreviewState({ entry });
}
