"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui";
import { THEME_COOKIE, parseTheme, themes, type Theme } from "@/lib/theme";

const labels: Record<Theme, string> = { system: "Match device", light: "Light", dark: "Dark" };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const readTheme = () => parseTheme(document.documentElement.dataset.theme);

/** Cycles device → light → dark. The cookie lets the server render the right theme with no flash. */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initial);
  function cycle() {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    listeners.forEach((listener) => listener());
  }
  return (
    <button type="button" className="nav-link" onClick={cycle} aria-label={`Appearance: ${labels[theme]}. Change appearance`}>
      <Icon name="theme" />Appearance<span className="nav-value">{labels[theme]}</span>
    </button>
  );
}
