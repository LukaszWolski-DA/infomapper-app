import { afterEach, describe, expect, it } from "vitest";
import { isDevSignInEnabled, userIdFromDevCookie } from "./dev-session";

const env = process.env as Record<string, string | undefined>;
const original = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = original;
});

const id = "01a0f9e9-2000-7588-bf2c-d0927cb58233";

describe("development session cookie (AD-29)", () => {
  it("is accepted in development", () => {
    env.NODE_ENV = "development";
    expect(isDevSignInEnabled()).toBe(true);
    expect(userIdFromDevCookie(id)).toBe(id);
  });

  it("is refused in production", () => {
    env.NODE_ENV = "production";
    expect(isDevSignInEnabled()).toBe(false);
    expect(userIdFromDevCookie(id)).toBeNull();
  });

  it("must hold a user id", () => {
    env.NODE_ENV = "development";
    expect(userIdFromDevCookie(undefined)).toBeNull();
    expect(userIdFromDevCookie("admin")).toBeNull();
  });
});
