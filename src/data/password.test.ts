import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD, DEMO_PASSWORD_HASH } from "./local/demo-password";
import { hashWithSalt, SCRYPT_PARAMS, scryptHasher } from "./password";

describe("the scrypt password adapter (slice 8, items 14, 15, S8-13)", () => {
  it("stores parameters, salt and key in one string, with a random salt each time", async () => {
    const a = await scryptHasher.hash("correct horse");
    const b = await scryptHasher.hash("correct horse");
    expect(a).toMatch(/^scrypt\$15\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct horse");
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const stored = await scryptHasher.hash("correct horse");
    expect(await scryptHasher.verify("correct horse", stored)).toBe(true);
    expect(await scryptHasher.verify("correct horsE", stored)).toBe(false);
    expect(await scryptHasher.verify("", stored)).toBe(false);
  });

  it("refuses malformed hashes and parameters it would never write", async () => {
    for (const stored of ["", "demo-pass", "scrypt$15$8$1$abc", "scrypt$30$8$1$YWJj$YWJj", "bcrypt$10$x$y$z$w"]) {
      expect(await scryptHasher.verify("demo-pass", stored)).toBe(false);
    }
    // a key of the wrong length
    expect(await scryptHasher.verify("demo-pass", "scrypt$15$8$1$YWJj$YWJj")).toBe(false);
  });

  it("the seed's precomputed demo hash is the hash of demo-pass with the current parameters (F7)", async () => {
    expect(await scryptHasher.verify(DEMO_PASSWORD, DEMO_PASSWORD_HASH)).toBe(true);
    expect(await hashWithSalt(DEMO_PASSWORD, Buffer.from("infomapper-demo!"))).toBe(DEMO_PASSWORD_HASH);
    expect(DEMO_PASSWORD_HASH.startsWith(`scrypt$${SCRYPT_PARAMS.log2N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$`)).toBe(true);
  });
});
