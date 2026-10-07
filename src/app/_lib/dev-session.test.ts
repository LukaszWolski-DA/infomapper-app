import { afterEach, describe, expect, it } from "vitest";
import { isDevSignInEnabled, userIdFromDevCookie } from "./dev-session";

const env = process.env as Record<string, string | undefined>;
const original = { node: env.NODE_ENV, measure: env.INFOMAPPER_MEASURE };
afterEach(() => {
  env.NODE_ENV = original.node;
  env.INFOMAPPER_MEASURE = original.measure;
});

const id = "01a0f9e9-2000-7588-bf2c-d0927cb58233";

describe("development session cookie (AD-29)", () => {
  it("is accepted in development", () => {
    env.NODE_ENV = "development";
    expect(isDevSignInEnabled()).toBe(true);
    expect(userIdFromDevCookie(id)).toBe(id);
  });

  it("is refused in a normal production build, also with INFOMAPPER_MEASURE set to anything but 1", () => {
    env.NODE_ENV = "production";
    for (const measure of [undefined, "", "0", "true"]) {
      env.INFOMAPPER_MEASURE = measure;
      expect(isDevSignInEnabled()).toBe(false);
      expect(userIdFromDevCookie(id)).toBeNull();
    }
  });

  it("is accepted in the measurement-only production build (INFOMAPPER_MEASURE=1, AD-31)", () => {
    env.NODE_ENV = "production";
    env.INFOMAPPER_MEASURE = "1";
    expect(isDevSignInEnabled()).toBe(true);
    expect(userIdFromDevCookie(id)).toBe(id);
  });

  it("must hold a user id", () => {
    env.NODE_ENV = "development";
    expect(userIdFromDevCookie(undefined)).toBeNull();
    expect(userIdFromDevCookie("admin")).toBeNull();
  });
});
