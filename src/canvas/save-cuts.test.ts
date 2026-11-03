import { describe, expect, it } from "vitest";
import { CUTTING_REFUSALS, FRESH_WAIT_MS, FreshWaits, PAGE_REFUSALS, SaveCuts } from "./save-cuts";

describe("SaveCuts (slice 14a, F2)", () => {
  it("cuts a save queued before a cutting refusal of its row", () => {
    const cuts = new SaveCuts();
    const mark = cuts.mark("n1");
    cuts.refuse("n1", "stale_version");
    expect(cuts.cutSince("n1", mark)).toBe(true);
  });

  it("does not cut a save queued after the refusal was answered", () => {
    const cuts = new SaveCuts();
    cuts.refuse("n1", "stale_version");
    expect(cuts.cutSince("n1", cuts.mark("n1"))).toBe(false);
  });

  it("cuts on a stale version, a permission, the archive, a row not found and a locked organization", () => {
    for (const code of ["stale_version", "forbidden", "archived", "not_found", "locked"]) {
      const cuts = new SaveCuts();
      const mark = cuts.mark("f1");
      cuts.refuse("f1", code);
      expect(cuts.cutSince("f1", mark)).toBe(true);
    }
    expect([...CUTTING_REFUSALS].sort()).toEqual(["archived", "forbidden", "locked", "not_found", "stale_version"]);
  });

  it("an invalid input, an unexpected error or a cut save cuts nothing", () => {
    const cuts = new SaveCuts();
    const mark = cuts.mark("n1");
    for (const code of ["invalid", "unexpected", "cut", undefined]) cuts.refuse("n1", code);
    expect(cuts.cutSince("n1", mark)).toBe(false);
  });

  it("a refusal of one row cuts nothing of another", () => {
    const cuts = new SaveCuts();
    const mark = cuts.mark("n2");
    cuts.refuse("n1", "stale_version");
    expect(cuts.cutSince("n2", mark)).toBe(false);
  });
});

describe("FreshWaits (slice 14a, F3)", () => {
  const manual = () => {
    const timers: (() => void)[] = [];
    return { timers, timeout: (run: () => void, ms: number) => (expect(ms).toBe(FRESH_WAIT_MS), void timers.push(run)) };
  };

  it("answers once the next fresh page has been merged", () => {
    const fresh = new FreshWaits();
    const t = manual();
    let answered = 0;
    fresh.wait(fresh.pages, () => answered++, t.timeout);
    expect(answered).toBe(0);
    fresh.merged();
    expect(answered).toBe(1);
    // the time limit afterwards answers nothing more
    t.timers[0]!();
    expect(answered).toBe(1);
  });

  it("answers after the time limit when no page comes", () => {
    const fresh = new FreshWaits();
    const t = manual();
    let answered = 0;
    fresh.wait(fresh.pages, () => answered++, t.timeout);
    t.timers[0]!();
    expect(answered).toBe(1);
    fresh.merged();
    expect(answered).toBe(1);
  });

  it("answers at once when a page was merged after the save was sent", () => {
    const fresh = new FreshWaits();
    const sent = fresh.pages;
    fresh.merged();
    let answered = 0;
    fresh.wait(sent, () => answered++, () => expect.unreachable());
    expect(answered).toBe(1);
  });

  it("only the refusals that bring a page wait for one", () => {
    expect([...PAGE_REFUSALS].sort()).toEqual(["archived", "forbidden", "not_found", "stale_version"]);
    expect(PAGE_REFUSALS.has("locked")).toBe(false);
    expect(PAGE_REFUSALS.has("invalid")).toBe(false);
  });
});
