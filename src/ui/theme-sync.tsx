"use client";

// The theme in the browser (slice 32, D-85, P3). `chooseTheme` is the menu's click: the cookie first, then the attribute,
// so a later render of the root layout (a `router.refresh()`) reads the same choice the page shows. `ThemeSync` brings a
// page that was not there for the click into step: a page restored from the browser's back-forward cache (`pageshow`)
// and another tab when it is shown again (`visibilitychange`). Mounted once, in the root layout; renders nothing, so no
// page re-renders for it.

import { useEffect } from "react";
import { themeAttribute, themeCookieText, themeOfCookies, type Theme } from "./theme";

/** The choice the page shows now (the attribute on `<html>`). */
export function shownTheme(): Theme {
  const v = document.documentElement.dataset.theme;
  return v === "light" || v === "dark" ? v : "system";
}

function showTheme(theme: Theme): void {
  const root = document.documentElement;
  const attr = themeAttribute(theme);
  if (attr) root.dataset.theme = attr;
  else delete root.dataset.theme;
}

/** A choice made in the menu: remembered in the cookie, then shown at once. */
export function chooseTheme(theme: Theme): void {
  document.cookie = themeCookieText(theme);
  showTheme(theme);
}

export function ThemeSync(): null {
  useEffect(() => {
    const sync = () => {
      const theme = themeOfCookies(document.cookie);
      if (theme !== shownTheme()) showTheme(theme);
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) sync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
