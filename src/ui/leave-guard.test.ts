import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asksToStay, guard, hold, isListening, release, track } from "./leave-guard";

/** A window with only what the guard uses; `leave()` fires `beforeunload` and says whether the page asked. */
function stubWindow() {
  const target = new EventTarget();
  vi.stubGlobal("window", { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target) });
  return {
    leave: () => {
      const e = new Event("beforeunload", { cancelable: true });
      // a browser's BeforeUnloadEvent lets the page set it; Node's Event does not
      Object.defineProperty(e, "returnValue", { writable: true, value: true });
      target.dispatchEvent(e);
      return e.defaultPrevented;
    },
  };
}

describe("the warning before the page is left (slice 14b, items 8–9)", () => {
  let page: ReturnType<typeof stubWindow>;
  beforeEach(() => (page = stubWindow()));
  afterEach(() => vi.unstubAllGlobals());

  it("listens only while something holds, and asks only then", () => {
    expect(isListening()).toBe(false);
    expect(page.leave()).toBe(false);
    hold("field-1");
    hold("notes");
    expect(isListening()).toBe(true);
    expect(page.leave()).toBe(true);
    release("field-1");
    expect(page.leave()).toBe(true);
    release("notes");
    expect(isListening()).toBe(false);
    expect(page.leave()).toBe(false);
  });

  it("asks a check when the page is left: a hold whose check says no asks nothing", () => {
    let here = false;
    hold("kept", () => here);
    expect(isListening()).toBe(true);
    expect(page.leave()).toBe(false);
    here = true;
    expect(page.leave()).toBe(true);
    expect(asksToStay()).toBe(true);
    release("kept");
  });

  it("guard holds and releases by the unsaved state; releasing twice is harmless", () => {
    guard("field", true);
    guard("field", true);
    expect(asksToStay()).toBe(true);
    guard("field", false);
    guard("field", false);
    expect(isListening()).toBe(false);
  });

  it("holds while any save tracked under a key is on its way, a refused one too", async () => {
    let first!: () => void;
    let second!: (e: Error) => void;
    const a = track("saves", new Promise<void>((done) => (first = done)));
    const b = track("saves", new Promise<void>((_, fail) => (second = fail)));
    b.catch(() => {});
    expect(page.leave()).toBe(true);
    first();
    await a;
    expect(page.leave()).toBe(true);
    second(new Error("refused"));
    await b.catch(() => {});
    await Promise.resolve();
    expect(isListening()).toBe(false);
    expect(page.leave()).toBe(false);
  });
});
