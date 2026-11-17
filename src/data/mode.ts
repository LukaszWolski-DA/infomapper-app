// Which adapter the server runs on (slice 29, Q4): `INFOMAPPER_DATA`, "local" (the default, also when unset) or
// "postgres". Set only by `npm run dev:pg`, the Postgres scripts, CI's Postgres jobs and Vercel's Preview environment;
// never in `.env.local`, or `npm run dev` would leave the local adapter.
//
// The two never mix: on Postgres the local adapter refuses to start and no JSON file is read or written; on the local
// adapter no connection is opened.

export const DATA_ENV = "INFOMAPPER_DATA";

export type DataMode = "local" | "postgres";

export function dataMode(): DataMode {
  const value = process.env[DATA_ENV];
  if (value === undefined || value === "" || value === "local") return "local";
  if (value === "postgres") return "postgres";
  throw new Error(`${DATA_ENV} must be "local" or "postgres".`);
}

export const isPostgresMode = (): boolean => dataMode() === "postgres";

export class PostgresModeRefusedError extends Error {
  constructor(what: string) {
    super(`${what} is the local adapter's, and ${DATA_ENV}=postgres is set: nothing was read or written (slice 29, Q4).`);
    this.name = "PostgresModeRefusedError";
  }
}

/** Refuses the local adapter's files while the server runs on Postgres. */
export function assertLocalMode(what: string): void {
  if (isPostgresMode()) throw new PostgresModeRefusedError(what);
}
