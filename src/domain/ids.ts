// UUID version 7 ids, created by the application (AD-11). The database never generates ids.
// Layout (RFC 9562): 48-bit Unix time in ms, version 7, 12-bit counter, variant 10, 62 random bits.
// The counter keeps ids from one process strictly increasing, even within the same millisecond.

export type Uuid = string;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let lastMs = -1;
let counter = 0;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function uuidv7(nowMs: number = Date.now()): Uuid {
  let ms = Math.max(nowMs, lastMs);
  if (ms === lastMs) {
    counter += 1;
    if (counter > 0xfff) {
      // Counter overflow: borrow the next millisecond.
      ms += 1;
      counter = 0;
    }
  } else {
    // Start each millisecond at a random value in the lower half so there is room to count up.
    counter = (randomBytes(2)[0]! << 3) & 0x7ff;
  }
  lastMs = ms;

  const bytes = randomBytes(16);
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = (ms >>> 24) & 0xff;
  bytes[3] = (ms >>> 16) & 0xff;
  bytes[4] = (ms >>> 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = 0x70 | ((counter >>> 8) & 0x0f);
  bytes[7] = counter & 0xff;
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuid(value: unknown): value is Uuid {
  return typeof value === "string" && UUID_RE.test(value);
}

/** The time encoded in a UUID v7, in ms since the Unix epoch. */
export function uuidv7Time(id: Uuid): number {
  return parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}
