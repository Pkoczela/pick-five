"use client";

import { useSyncExternalStore, type Dispatch, type SetStateAction } from "react";

const prefix = "pick-five-ui-preview-v1:";
const eventName = "pick-five-preview-change";
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  return () => window.removeEventListener(eventName, callback);
}

/** Only synthetic prototype state; never used for authentication or real entries. */
export function useSampleSession<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const fallback = JSON.stringify(initial);
  const snapshot = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(prefix + name) ?? fallback; } catch { return fallback; }
  }, () => fallback);
  let value: T;
  try { value = JSON.parse(snapshot) as T; } catch { value = initial; }
  const setValue: Dispatch<SetStateAction<T>> = update => {
    const next = typeof update === "function" ? (update as (previous: T) => T)(value) : update;
    sessionStorage.setItem(prefix + name, JSON.stringify(next));
    window.dispatchEvent(new Event(eventName));
  };
  return [value, setValue];
}

export function resetSampleSession() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(eventName));
}
