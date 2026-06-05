"use client";

import { useEffect, useSyncExternalStore } from "react";

const THEME_KEY = "kealvi_theme";

type ThemePreference = "light" | "dark";
type ThemeSnapshot = ThemePreference | "system-light" | "system-dark";

type MediaQueryListWithListener = MediaQueryList & {
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
};

function readCookieTheme(): ThemePreference | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_KEY}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "dark" || value === "light" ? value : null;
}

function readPreferredTheme(): ThemePreference | null {
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === "dark" || fromDom === "light") return fromDom;

  try {
    const fromStorage = localStorage.getItem(THEME_KEY);
    if (fromStorage === "dark" || fromStorage === "light") return fromStorage;
  } catch {
    // ignore
  }

  return readCookieTheme();
}

function getThemeSnapshot(): ThemeSnapshot {
  if (typeof window === "undefined") return "system-light";

  const preferred = readPreferredTheme();
  if (preferred) return preferred;

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return systemDark ? "system-dark" : "system-light";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("theme-change", onStoreChange);

  const mql = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ) as MediaQueryListWithListener;
  mql.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("theme-change", onStoreChange);
    mql.removeEventListener("change", onStoreChange);
  };
}

function setPreferredTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_KEY}=${encodeURIComponent(
    theme
  )}; path=/; max-age=${maxAge}; samesite=lax`;
}

export default function ThemeToggle() {
  const snapshot = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    () => "system-light"
  );

  const preferredTheme: ThemePreference | null =
    snapshot === "dark" || snapshot === "light" ? snapshot : null;
  const dark = snapshot === "dark" || snapshot === "system-dark";

  useEffect(() => {
    if (preferredTheme) {
      setPreferredTheme(preferredTheme);
      return;
    }

    document.documentElement.removeAttribute("data-theme");
  }, [preferredTheme]);

  function toggleTheme() {
    const nextTheme: ThemePreference = dark ? "light" : "dark";
    setPreferredTheme(nextTheme);
    window.dispatchEvent(new Event("theme-change"));
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full border border-[var(--reddit-blue)] px-3 py-1.5 text-xs font-bold text-[var(--reddit-blue)] transition hover:bg-[var(--reddit-blue)] hover:text-white"
    >
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
