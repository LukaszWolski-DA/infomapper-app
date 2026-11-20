import { describe, expect, it } from "vitest";
import { parseTheme, themeAttribute, themeCookieText, themeOfCookies, THEME_COOKIE_MAX_AGE } from "./theme";

describe("the theme's cookie (slice 32)", () => {
  it("reads light and dark, and anything else as System", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const v of [undefined, null, "", "system", "Dark", " dark", "blue", "light;"]) expect(parseTheme(v)).toBe("system");
  });

  it("puts no attribute on <html> for System", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
  });

  it("writes a year's cookie for a choice and deletes it for System", () => {
    expect(themeCookieText("dark")).toBe(`im-theme=dark; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`);
    expect(themeCookieText("light")).toBe(`im-theme=light; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`);
    expect(themeCookieText("system")).toBe("im-theme=; path=/; max-age=0; samesite=lax");
    expect(THEME_COOKIE_MAX_AGE).toBe(31536000);
  });

  it("finds the choice among the browser's cookies", () => {
    expect(themeOfCookies("")).toBe("system");
    expect(themeOfCookies("a=1; im-theme=dark; b=2")).toBe("dark");
    expect(themeOfCookies("im-theme=light")).toBe("light");
    expect(themeOfCookies("im-theme=; x=1")).toBe("system");
    expect(themeOfCookies("xim-theme=dark")).toBe("system");
    expect(themeOfCookies("im-theme=sepia")).toBe("system");
  });
});
