// The secret that signs development session cookies (slice 8, F1): INFOMAPPER_SESSION_SECRET (at least 32 characters,
// in .env.local) if set, else 32 random bytes in .data/session-secret, written on first use. .data/ is git-ignored. A new
// secret signs everyone out once and changes nothing else. Never logged.

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertNotProduction } from "./file";

let cached: Buffer | null = null;

export function sessionSecretFile(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), ".data", "session-secret");
}

export function sessionSecret(): Buffer {
  if (cached) return cached;
  assertNotProduction();
  const fromEnv = process.env.INFOMAPPER_SESSION_SECRET;
  if (fromEnv !== undefined && fromEnv !== "") {
    if (fromEnv.length < 32) throw new Error("INFOMAPPER_SESSION_SECRET must be at least 32 characters.");
    cached = Buffer.from(fromEnv, "utf8");
    return cached;
  }
  const file = sessionSecretFile();
  try {
    cached = Buffer.from(readFileSync(file, "utf8").trim(), "base64url");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    mkdirSync(path.dirname(file), { recursive: true });
    const fresh = randomBytes(32).toString("base64url");
    try {
      // `wx`: if another process (the e2e server and a test) wrote it first, read theirs
      writeFileSync(file, fresh + "\n", { encoding: "utf8", flag: "wx" });
    } catch (w) {
      if ((w as NodeJS.ErrnoException).code !== "EEXIST") throw w;
    }
    cached = Buffer.from(readFileSync(file, "utf8").trim(), "base64url");
  }
  if (cached.length < 32) throw new Error(`${file} is too short; delete it to make a new one.`);
  return cached;
}
