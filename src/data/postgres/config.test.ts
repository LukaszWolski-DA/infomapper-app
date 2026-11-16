import { describe, expect, it } from "vitest";
import { pgClientConfig, pgTypes, timestampText } from "./config";

describe("timestamptz as the domain reads it (slice 29, F2 condition 2, F4)", () => {
  it("truncates the microseconds that carry the stored order: the domain sees milliseconds only", () => {
    expect(timestampText("2026-11-16 10:00:00.123999+00")).toBe("2026-11-16T10:00:00.123Z");
    expect(timestampText("2026-11-16 10:00:00.000001+00")).toBe("2026-11-16T10:00:00.000Z");
    expect(timestampText("2026-11-16 10:00:00.999999+00")).toBe("2026-11-16T10:00:00.999Z");
  });
  it("reads every form Postgres prints: no fraction, a short fraction, other offsets", () => {
    expect(timestampText("2026-11-16 10:00:00+00")).toBe("2026-11-16T10:00:00.000Z");
    expect(timestampText("2026-11-16 10:00:00.5+00")).toBe("2026-11-16T10:00:00.500Z");
    expect(timestampText("2026-11-16 11:00:00.25+01")).toBe("2026-11-16T10:00:00.250Z");
    expect(timestampText("2026-11-16 05:30:00.25-04:30")).toBe("2026-11-16T10:00:00.250Z");
  });
  it("gives back what the app wrote (toISOString, milliseconds)", () => {
    const written = new Date("2026-11-16T10:00:00.123Z").toISOString();
    expect(timestampText("2026-11-16 10:00:00.123+00")).toBe(written);
  });
  it("refuses a text it does not know", () => {
    expect(() => timestampText("yesterday")).toThrow();
  });
});

describe("the pool's types (F4)", () => {
  it("reads numeric and bigint as numbers, timestamptz through timestampText, others as node-postgres does", () => {
    expect(pgTypes.getTypeParser(1700)("12.5")).toBe(12.5);
    expect(pgTypes.getTypeParser(20)("9007199254740991")).toBe(9007199254740991);
    expect(pgTypes.getTypeParser(1184)("2026-11-16 10:00:00.123456+00")).toBe("2026-11-16T10:00:00.123Z");
    expect(pgTypes.getTypeParser(23)("7")).toBe(7);
  });
});

describe("the connection's TLS (F6)", () => {
  it("drops the connection string's own sslmode and verifies against Supabase's root certificate", () => {
    const config = pgClientConfig("postgresql://u:p@example.pooler.supabase.com:6543/postgres?sslmode=require");
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(String((config.ssl as { ca: string }).ca)).toContain("BEGIN CERTIFICATE");
  });
  it("uses no TLS for a database on this machine (CI's container)", () => {
    expect(pgClientConfig("postgres://postgres:postgres@localhost:5432/x").ssl).toBe(false);
  });
});
