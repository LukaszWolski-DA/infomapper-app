// The theme (slice 32, D-85): Light, Dark or System (the default), one choice per browser, not per person (the sign-in
// page has no person). A cookie the browser writes and the server reads, so the root layout puts the choice on `<html>`
// (`data-theme`) and the first paint is right with no script. System has no cookie and no attribute: the dark values
// then follow `prefers-color-scheme` (Tailwind's `dark` variant, `globals.css`). Any other value reads as System.

export type Theme = "light" | "dark" | "system";

/** The menu's choices, in the prototype's order (`THEMES`). */
export const THEME_OPTIONS: readonly (readonly [Theme, string])[] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "System"],
];

export const THEME_COOKIE = "im-theme";

/** A year, like the other preferences. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The cookie's value as a choice: `light` or `dark`, anything else (or none) System. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** The attribute on `<html>` for a choice: none for System. */
export const themeAttribute = (theme: Theme): "light" | "dark" | undefined => (theme === "system" ? undefined : theme);

/** What the browser writes into `document.cookie` for a choice: System deletes the cookie. */
export function themeCookieText(theme: Theme): string {
  return theme === "system"
    ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

/** The choice in a `document.cookie` string. */
export function themeOfCookies(cookies: string): Theme {
  for (const part of cookies.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === THEME_COOKIE) return parseTheme(part.slice(i + 1).trim());
  }
  return "system";
}
