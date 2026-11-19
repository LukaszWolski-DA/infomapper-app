import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUSY_TEXT, FADE_MS, failureText, NO_ANSWER_MS, reportedAll, reportSave, SAVED_MS, saveState } from "./save-state";

const phase = () => saveState.getSnapshot().phase;
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("the save state (slice 30, Q6, L5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveState.reset();
  });
  afterEach(() => vi.useRealTimers());

  it("shows Saving… while a write is on its way, then Saved, the fade and nothing", async () => {
    const w = deferred<{ ok: true }>();
    void reportSave(w.promise, "row");
    expect(phase()).toBe("saving");
    w.resolve({ ok: true });
    await flush();
    expect(phase()).toBe("saved");
    await vi.advanceTimersByTimeAsync(SAVED_MS);
    expect(phase()).toBe("fading");
    await vi.advanceTimersByTimeAsync(FADE_MS);
    expect(phase()).toBe("idle");
  });

  it("stays Saving… until the last of several writes is answered", async () => {
    const a = deferred<{ ok: true }>();
    const b = deferred<{ ok: true }>();
    void reportSave(a.promise, "row");
    void reportSave(b.promise, "canvas");
    a.resolve({ ok: true });
    await flush();
    expect(phase()).toBe("saving");
    b.resolve({ ok: true });
    await flush();
    expect(phase()).toBe("saved");
  });

  it("shows Not saved after a refusal, with its message, until a later write succeeds", async () => {
    await reportSave(Promise.resolve({ ok: false, code: "stale_version", message: "Someone changed this meanwhile." }), "row");
    expect(saveState.getSnapshot()).toEqual({ phase: "failed", failure: { kind: "row", reason: "refused", message: "Someone changed this meanwhile." } });
    const later = deferred<{ ok: true }>();
    void reportSave(later.promise, "row");
    // the next write shows Saving… (the prototype's begin()), and Saved once it succeeds
    expect(phase()).toBe("saving");
    later.resolve({ ok: true });
    await flush();
    expect(phase()).toBe("saved");
  });

  it("does not count a save that a refusal before it cut, nor a write without an ok field", async () => {
    await reportSave(Promise.resolve({ ok: false, code: "cut", message: "" }), "row");
    expect(phase()).toBe("saved");
    await reportSave(Promise.resolve(undefined), "canvas");
    expect(phase()).toBe("saved");
  });

  it("shows Not saved for a thrown write and for one without an answer after 30 s, which clears if it succeeds", async () => {
    await reportSave(Promise.reject(new Error("network")), "canvas").catch(() => undefined);
    expect(saveState.getSnapshot().failure).toEqual({ kind: "canvas", reason: "silent", message: "" });
    saveState.reset();
    const slow = deferred<{ ok: true }>();
    void reportSave(slow.promise, "row");
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS);
    expect(saveState.getSnapshot().failure?.reason).toBe("silent");
    expect(phase()).toBe("failed");
    slow.resolve({ ok: true });
    await flush();
    expect(phase()).toBe("saved");
  });

  it("gives the busy refusal its own reason", async () => {
    await reportSave(Promise.resolve({ ok: false, code: "invalid", message: BUSY_TEXT }), "row");
    expect(saveState.getSnapshot().failure?.reason).toBe("busy");
  });

  it("wraps every function of an object, and nothing else", async () => {
    const writes = reportedAll({ save: async () => ({ ok: true }), name: "x" }, "canvas");
    expect(writes.name).toBe("x");
    const pending = writes.save();
    expect(phase()).toBe("saving");
    await pending;
    expect(phase()).toBe("saved");
  });
});

describe("the tooltip of Not saved (L5)", () => {
  it("says why and what to do, by the kind of write and of failure", () => {
    expect(failureText({ kind: "row", reason: "refused", message: "Someone changed this meanwhile." })).toBe(
      "Your last change was not saved: Someone changed this meanwhile. A text you typed is kept in its field.",
    );
    expect(failureText({ kind: "canvas", reason: "refused", message: "This card no longer exists." })).toBe(
      "Your last change was not saved: This card no longer exists. It was taken back here; make it again.",
    );
    expect(failureText({ kind: "canvas", reason: "silent", message: "" })).toBe(
      "Your last change was not saved: the server did not answer. It was taken back here; make it again. If this repeats, check your connection and reload the page.",
    );
    expect(failureText({ kind: "change", reason: "silent", message: "" })).toBe(
      "Your last change was not saved: the server did not answer. Make it again. If this repeats, check your connection and reload the page.",
    );
    expect(failureText({ kind: "row", reason: "busy", message: BUSY_TEXT })).toBe(
      "Your last change was not saved: The workspace is busy saving a large change. Try again in a moment.",
    );
  });
});
