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

  it("cuts the saves waiting behind a stale version, a permission, the archive or a row not found (slice 10a, F5); a later save is sent", async () => {
    for (const code of ["stale_version", "forbidden", "archived", "not_found"]) {
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

/** A several-row save the test answers by hand: the versions it sent for its checked rows, and its answer. */
function pendingRows(checked: readonly string[]) {
  const calls: { versions: Record<string, number>; answer: (o: SaveOutcome) => void }[] = [];
  const send = (versionOf: (id: string) => number) =>
    new Promise<SaveOutcome>((answer) => calls.push({ versions: Object.fromEntries(checked.map((id) => [id, versionOf(id)])), answer }));
  return { calls, send };
}

describe("RowSaves.saveRows (slice 10a, F3)", () => {
  // a move: attribute m is moved (its version checked), its siblings a and b are renumbered (held)
  const MOVE = [{ id: "m", shown: 1 }, { id: "a" }, { id: "b" }];

  it("waits for a save of any row it lists that is on its way, then sends the checked rows' newest versions", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["m"]);
    void saves.save("a", 3, one.send); // a sibling's name, on its way
    void saves.saveRows(MOVE, rows.send);
    await tick();
    expect(rows.calls).toHaveLength(0);
    one.calls[0]!.answer(stored(4));
    await tick();
    expect(rows.calls.map((c) => c.versions)).toEqual([{ m: 1 }]);
  });

  it("holds every row it lists: a one-row save started meanwhile waits for it and sends the version it returned", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["m"]);
    void saves.saveRows(MOVE, rows.send);
    void saves.save("b", 5, one.send); // a sibling's name, typed while the move is on its way
    void saves.save("m", 1, one.send); // the moved attribute's own panel
    await tick();
    expect(one.calls).toHaveLength(0);
    rows.calls[0]!.answer({ ok: true, value: { position: 0 }, versions: { m: 2, a: 4, b: 6 } });
    await tick();
    // two different rows: in either order, each with the version the move returned
    expect(one.calls.map((c) => c.version).sort()).toEqual([2, 6]);
  });

  it("feeds back every version of the answer, and its value's version to the first checked row", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["x", "y"]);
    const merge = saves.saveRows([{ id: "x", shown: 2 }, { id: "y", shown: 7 }], rows.send);
    await tick();
    expect(rows.calls.map((c) => c.versions)).toEqual([{ x: 2, y: 7 }]);
    rows.calls[0]!.answer({ ok: true, value: { version: 3 }, versions: { y: 8 } });
    await merge;
    void saves.save("x", 2, one.send);
    void saves.save("y", 7, one.send);
    await tick();
    expect(one.calls.map((c) => c.version)).toEqual([3, 8]);
  });

  it("a cutting refusal cuts the waiting saves of every row it lists, held ones too; other rows go on", async () => {
    for (const code of ["stale_version", "forbidden", "archived", "not_found"]) {
      const saves = new RowSaves();
      const one = pendingSave();
      const rows = pendingRows(["m"]);
      void saves.saveRows(MOVE, rows.send);
      const checked = saves.save("m", 1, one.send);
      const held = saves.save("a", 3, one.send);
      const other = saves.save("c", 9, one.send);
      await tick();
      expect(one.calls.map((c) => c.version)).toEqual([9]);
      rows.calls[0]!.answer({ ok: false, code });
      expect(await checked).toBeNull();
      expect(await held).toBeNull();
      one.calls[0]!.answer(stored(10));
      expect(await other).toEqual(stored(10));
      expect(one.calls).toHaveLength(1);
    }
  });

  it("is not sent when a refusal before it cut one of its checked rows; a held row's cut does not stop it", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["m"]);
    void saves.save("m", 1, one.send);
    const cut = saves.saveRows(MOVE, rows.send);
    await tick();
    one.calls[0]!.answer({ ok: false, code: "stale_version" });
    expect(await cut).toBeNull();
    expect(rows.calls).toHaveLength(0);

    const later = new RowSaves();
    const sibling = pendingSave();
    const move = pendingRows(["m"]);
    void later.save("a", 3, sibling.send);
    const sent = later.saveRows(MOVE, move.send);
    await tick();
    sibling.calls[0]!.answer({ ok: false, code: "stale_version" });
    await tick();
    expect(move.calls).toHaveLength(1);
    move.calls[0]!.answer({ ok: true, versions: { m: 2, a: 4, b: 2 } });
    expect(await sent).toMatchObject({ ok: true });
  });

  it("a validation refusal cuts nothing", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["m"]);
    void saves.saveRows(MOVE, rows.send);
    void saves.save("a", 3, one.send);
    await tick();
    rows.calls[0]!.answer({ ok: false, code: "invalid" });
    await tick();
    expect(one.calls.map((c) => c.version)).toEqual([3]);
  });

  it("an undo waits for it, and saves started after the undo send the undo's versions", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["m"]);
    const order: string[] = [];
    void saves.saveRows(MOVE, rows.send);
    const undo = saves.exclusive(async () => {
      order.push(`undo after ${rows.calls.length} move(s)`);
      saves.answer({ m: 3, a: 5 });
    });
    void saves.save("a", 4, one.send);
    await tick();
    expect(order).toEqual([]);
    rows.calls[0]!.answer({ ok: true, versions: { m: 2, a: 4, b: 2 } });
    await undo;
    await tick();
    expect(order).toEqual(["undo after 1 move(s)"]);
    expect(one.calls.map((c) => c.version)).toEqual([5]);
  });

  it("a one-row saveRows is save: same order, same version", async () => {
    const saves = new RowSaves();
    const one = pendingSave();
    const rows = pendingRows(["a"]);
    void saves.saveRows([{ id: "a", shown: 1 }], rows.send);
    void saves.save("a", 1, one.send);
    await tick();
    rows.calls[0]!.answer(stored(2));
    await tick();
    expect(one.calls.map((c) => c.version)).toEqual([2]);
  });

  it("refuses to give a version of a row it does not check", async () => {
    const saves = new RowSaves();
    await expect(saves.saveRows([{ id: "a" }], async (versionOf) => ({ ok: true, value: { version: versionOf("a") } }))).rejects.toThrow(/not a checked row/);
  });
});

describe("Undo and a canvas write (slice 10a, F4)", () => {
  // Before slice 10a a canvas action's write ran through plain `run`, outside the chain: an undo did not wait for it
  // (only Next.js's sequential dispatch kept it in front). On the chain, the undo waits.
  it("an undo does not wait for a write outside the chain, and does wait for the same write on the chain", async () => {
    for (const onChain of [false, true]) {
      const saves = new RowSaves();
      const { calls, send } = pendingSave();
      let undone = false;
      if (onChain) void saves.save("mapping", 1, send);
      else void send(1); // run(() => setMappingStatusAction({ expectedVersion: m.version }))
      const undo = saves.exclusive(async () => {
        undone = true;
      });
      await tick();
      expect(undone).toBe(!onChain);
      calls[0]!.answer(stored(2));
      await undo;
      expect(undone).toBe(true);
    }
  });
});
