import { createHmac, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { decodeSession, encodeSession, isDevSignInEnabled } from "./dev-session";

const env = process.env as Record<string, string | undefined>;
const original = { node: env.NODE_ENV, measure: env.INFOMAPPER_MEASURE };
afterEach(() => {
  env.NODE_ENV = original.node;
  env.INFOMAPPER_MEASURE = original.measure;
});

const id = "01a0f9e9-2000-7588-bf2c-d0927cb58233";
const org = "01a0f9e9-2005-7a0f-9b37-5bd5b46f86bc";
const secret = randomBytes(32);
const session = { userId: id, unlocked: [org] };

describe("development session cookie (AD-29; slice 8, F1)", () => {
  it("is accepted in development", () => {
    env.NODE_ENV = "development";
    expect(isDevSignInEnabled()).toBe(true);
    expect(decodeSession(encodeSession(session, secret), secret)).toEqual(session);
  });

  it("is refused in a normal production build, also with INFOMAPPER_MEASURE set to anything but 1", () => {
    env.NODE_ENV = "development";
    const cookie = encodeSession(session, secret);
    env.NODE_ENV = "production";
    for (const measure of [undefined, "", "0", "true"]) {
      env.INFOMAPPER_MEASURE = measure;
      expect(isDevSignInEnabled()).toBe(false);
      expect(decodeSession(cookie, secret)).toBeNull();
    }
  });

  it("is accepted in the measurement-only production build (INFOMAPPER_MEASURE=1, AD-31)", () => {
    env.NODE_ENV = "production";
    env.INFOMAPPER_MEASURE = "1";
    expect(isDevSignInEnabled()).toBe(true);
    expect(decodeSession(encodeSession(session, secret), secret)).toEqual(session);
  });

  it("refuses a bare user id (the slice 0 cookie), another secret's signature and any edit", () => {
    env.NODE_ENV = "development";
    expect(decodeSession(undefined, secret)).toBeNull();
    expect(decodeSession(id, secret)).toBeNull();
    const cookie = encodeSession(session, secret);
    expect(decodeSession(cookie, randomBytes(32))).toBeNull();
    const [data, signature] = cookie.split(".");
    const other = Buffer.from(JSON.stringify({ v: 1, u: id, o: [org, "01a0f9e9-2006-7178-8cdf-249f50cfcf87"], at: 0 })).toString("base64url");
    expect(decodeSession(`${other}.${signature}`, secret)).toBeNull();
    expect(decodeSession(`${data}.${signature}x`, secret)).toBeNull();
    expect(decodeSession(`${data}.${signature}.x`, secret)).toBeNull();
  });

  it("refuses a signed payload of the wrong shape", () => {
    env.NODE_ENV = "development";
    const signed = (payload: unknown) => {
      const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
      return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
    };
    expect(decodeSession(signed({ v: 1, u: id, o: [org], at: 0 }), secret)).toEqual(session);
    expect(decodeSession(signed({ v: 2, u: id, o: [], at: 0 }), secret)).toBeNull();
    expect(decodeSession(signed({ v: 1, u: "admin", o: [], at: 0 }), secret)).toBeNull();
    expect(decodeSession(signed({ v: 1, u: id, o: ["x"], at: 0 }), secret)).toBeNull();
  });
});
