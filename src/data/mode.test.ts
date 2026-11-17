import { afterEach, describe, expect, it } from "vitest";
import { createLocalDataStore } from "./local/store";
import { DATA_ENV, dataMode } from "./mode";

const before = process.env[DATA_ENV];
afterEach(() => {
  if (before === undefined) delete process.env[DATA_ENV];
  else process.env[DATA_ENV] = before;
});

describe("the adapter switch (slice 29, Q4)", () => {
  it("is the local adapter unset, empty or local; Postgres only when asked", () => {
    delete process.env[DATA_ENV];
    expect(dataMode()).toBe("local");
    process.env[DATA_ENV] = "";
    expect(dataMode()).toBe("local");
    process.env[DATA_ENV] = "local";
    expect(dataMode()).toBe("local");
    process.env[DATA_ENV] = "postgres";
    expect(dataMode()).toBe("postgres");
  });
  it("refuses any other value", () => {
    process.env[DATA_ENV] = "supabase";
    expect(() => dataMode()).toThrow(/must be "local" or "postgres"/);
  });
  it("never starts the local adapter on Postgres: the two cannot mix", () => {
    process.env[DATA_ENV] = "postgres";
    expect(() => createLocalDataStore("unused.json")).toThrow(/local adapter's/);
  });
});
