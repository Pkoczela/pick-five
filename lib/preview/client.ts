"use client";

import { PREVIEW_COOKIE, parsePreviewState, serializePreviewState, type PreviewState } from "@/lib/preview/state";

export function readPreviewState() {
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${PREVIEW_COOKIE}=`))?.slice(PREVIEW_COOKIE.length + 1);
  return parsePreviewState(raw);
}

export function writePreviewState(patch: Partial<PreviewState>) {
  const next = { ...readPreviewState(), ...patch };
  document.cookie = `${PREVIEW_COOKIE}=${serializePreviewState(next)}; path=/; samesite=lax`;
  return next;
}

export function clearPreviewState() {
  document.cookie = `${PREVIEW_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Stands in for POST /api/entries while previewing. */
export async function saveSampleEntry(entry: PreviewState["entry"], { persist }: { persist: boolean }) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (readPreviewState().failSaves) throw new Error("Sample connection interrupted. Your selections are still here. Turn off “Fail saves” in the preview bar and try again.");
  if (persist) writePreviewState({ entry });
}
