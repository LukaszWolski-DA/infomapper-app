// Organization passwords (slice 8, items 14–15, F19): scrypt from node:crypto, server only, no new dependency. The
// stored string carries the parameters, the salt and the key: `scrypt$<log2 N>$<r>$<p>$<salt>$<key>` (base64url), so
// changing the parameters later still verifies older hashes. Comparison is in constant time. Neither the password nor
// the hash is ever logged.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { PasswordHasher } from "./ports";

/** N = 2^15, r = 8, p = 1: about 32 MiB and some tens of milliseconds per hash (section 6's bar: under 200 ms). */
export const SCRYPT_PARAMS = { log2N: 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

const scrypt = (password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key)));
  });

const optionsOf = (log2N: number, r: number, p: number): ScryptOptions => ({ N: 2 ** log2N, r, p, maxmem: MAX_MEMORY });

/** Hashes with the given salt; `hash` draws a random one. Exported for the seed's precomputed hash and its test. */
export async function hashWithSalt(password: string, salt: Buffer): Promise<string> {
  const { log2N, r, p } = SCRYPT_PARAMS;
  const key = await scrypt(password, salt, optionsOf(log2N, r, p));
  return ["scrypt", log2N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

const STORED = /^scrypt\$(\d{1,2})\$(\d{1,2})\$(\d{1,2})\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

export const scryptHasher: PasswordHasher = {
  hash: (password) => hashWithSalt(password, randomBytes(SALT_LENGTH)),

  async verify(password, stored) {
    const m = STORED.exec(stored);
    if (!m) return false;
    const [log2N, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
    // refuse parameters that would ask for more work or memory than this adapter ever writes
    if (log2N < 10 || log2N > 17 || r < 1 || r > 16 || p < 1 || p > 4) return false;
    const salt = Buffer.from(m[4]!, "base64url");
    const expected = Buffer.from(m[5]!, "base64url");
    if (expected.length !== KEY_LENGTH) return false;
    const key = await scrypt(password, salt, optionsOf(log2N, r, p));
    return timingSafeEqual(key, expected);
  },
};
