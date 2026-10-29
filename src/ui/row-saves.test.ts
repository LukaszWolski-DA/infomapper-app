import { describe, expect, it } from "vitest";
import { RowSaves, type SaveOutcome } from "./row-saves";

/** A save the test answers by hand: what it was sent with, and its answer. */
function pendingSave() {
  const calls: { version: number; answer: (o: SaveOutcome) => void }[] = [];
  const send = (version: number) => new Promise<SaveOutcome>((answer) => calls.push({ version, answer }));
  return { calls, send };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const stored = (version: number): SaveOutcome => ({ ok: true, value: { version } });

describe("RowSaves (slice 9, items 1–3)", () => {
  it("sends a row's second save after the first one's answer, with the version it returned (S9-01's case)", async () => {
    const saves = new RowSaves();
    const { calls, send } = pendingSave();
    const first = saves.save("a", 1, send);
    const second = saves.save("a", 1, send); // started before the first answer, from the same render
    await tick();
    expect(calls.map((c) => c.version)).toEqual([1]); // the second waits: our chain, not Next.js's queue
    calls[0]!.answer(stored(2));
    await tick();
    expect(calls.map((c) => c.version)).toEqual([1, 2]);
    calls[1]!.answer(stored(3));
    expect(await first).toEqual(stored(2));
    expect(await second).toEqual(stored(3));
  });

  it("sends the version the page shows when it is newer than the last answer (versions only grow)", async () => {
    const saves = new RowSaves();
    const { calls, send } = pendingSave();
    void saves.save("a", 1, send);
    await tick();
    calls[0]!.answer(stored(2));
    await tick();
    void saves.save("a", 5, send); // the fresh page shows 5 (an undo, someone else)
    await tick();
    expect(calls[1]!.version).toBe(5);
  });

  it("does not make saves of different rows wait for each other", async () => {
    const saves = new RowSaves();
    const { calls, send } = pendingSave();
    void saves.save("a", 1, send);
    void saves.save("b", 7, send);
    await tick();
    expect(calls.map((c) => c.version)).toEqual([1, 7]);
  });

  it("cuts the saves waiting behind a stale version, a permission or the archive; a later save is sent", async () => {
    for (const code of ["stale_version", "forbidden", "archived"]) {
      const saves = new RowSaves();
      const { calls, send } = pendingSave();
      void saves.save("a", 1, send);
      const waiting = saves.save("a", 1, send);
      await tick();
      calls[0]!.answer({ ok: false, code });
      expect(await waiting).toBeNull();
      expect(calls).toHaveLength(1);
      void saves.save("a", 4, send);
      await tick();
      expect(calls.map((c) => c.version)).toEqual([1, 4]);
    }
  });

  it("does not cut the saves behind a validation refusal", async () => {
    const saves = new RowSaves();
    const { calls, send } = pendingSave();
    void saves.save("a", 1, send);
    const waiting = saves.save("a", 1, send);
    await tick();
    calls[0]!.answer({ ok: false, code: "invalid" });
    await tick();
    expect(calls.map((c) => c.version)).toEqual([1, 1]);
    calls[1]!.answer(stored(2));
    expect(await waiting).toEqual(stored(2));
  });

  it("runs an undo after the saves on their way and before saves started meanwhile, which send the undo's versions (F5)", async () => {
    const saves = new RowSaves();
    const { calls, send } = pendingSave();
    const order: string[] = [];
    void saves.save("a", 1, send);
    const undo = saves.exclusive(async () => {
      order.push(`undo after ${calls.length} save(s)`);
      saves.answer({ a: 3 });
    });
    void saves.save("a", 1, send);
    await tick();
    expect(order).toEqual([]);
    calls[0]!.answer(stored(2));
    await undo;
    await tick();
    expect(order).toEqual(["undo after 1 save(s)"]);
    expect(calls.map((c) => c.version)).toEqual([1, 3]);
  });

  it("is settled when every save started so far has its answer", async () => {
    const saves = new RowSaves();
    const { calls, send } = pendingSave();
    void saves.save("a", 1, send);
    let done = false;
    void saves.settled().then(() => (done = true));
    await tick();
    expect(done).toBe(false);
    calls[0]!.answer(stored(2));
    await tick();
    expect(done).toBe(true);
  });
});
