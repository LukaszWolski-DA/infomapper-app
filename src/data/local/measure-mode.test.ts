import { afterEach, describe, expect, it } from "vitest";
import { assertNotProduction, ProductionRefusedError, readDb } from "./file";
import { isLocalHost, isLocalModeAllowed, isMeasurementBuild } from "./measure-mode";

const env = process.env as Record<string, string | undefined>;
const original = { node: env.NODE_ENV, measure: env.INFOMAPPER_MEASURE };
afterEach(() => {
  env.NODE_ENV = original.node;
  env.INFOMAPPER_MEASURE = original.measure;
});

describe("the local adapter in production (AD-29, AD-31)", () => {
  it("refuses a normal production build", async () => {
    env.NODE_ENV = "production";
    for (const measure of [undefined, "", "0", "yes"]) {
      env.INFOMAPPER_MEASURE = measure;
      expect(isLocalModeAllowed()).toBe(false);
      expect(isMeasurementBuild()).toBe(false);
      expect(() => assertNotProduction()).toThrow(ProductionRefusedError);
      await expect(readDb("unused.json")).rejects.toThrow(ProductionRefusedError);
    }
  });

  it("runs in the measurement-only build started with INFOMAPPER_MEASURE=1", () => {
    env.NODE_ENV = "production";
    env.INFOMAPPER_MEASURE = "1";
    expect(isMeasurementBuild()).toBe(true);
    expect(isLocalModeAllowed()).toBe(true);
    expect(() => assertNotProduction()).not.toThrow();
  });

  it("runs in development, where INFOMAPPER_MEASURE does not matter", () => {
    env.NODE_ENV = "development";
    env.INFOMAPPER_MEASURE = undefined;
    expect(isLocalModeAllowed()).toBe(true);
    expect(isMeasurementBuild()).toBe(false);
  });

  it("the measurement build answers this machine only", () => {
    for (const host of ["localhost:3300", "127.0.0.1:3300", "LOCALHOST", "[::1]:3300"]) expect(isLocalHost(host)).toBe(true);
    for (const host of ["192.168.1.106:3300", "example.com", "", null]) expect(isLocalHost(host)).toBe(false);
  });
});
