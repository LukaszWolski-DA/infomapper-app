import { describe, expect, it } from "vitest";
import { draftRefusal, inConflict, NoteDrafts, onLeave } from "./note-drafts";

describe("NoteDrafts (slice 14a, D-66)", () => {
  it("a stored save ends the draft; text typed after it stays on the new base", () => {
    const d = new NoteDrafts();
    d.start("n", "one", "old");
    expect(d.get("n")).toEqual({ text: "one", base: "old", sent: "one", refusal: null });
    d.start("n", "one two", "old");
    d.stored("n", "one");
    expect(d.get("n")).toEqual({ text: "one two", base: "one", sent: "one two", refusal: null });
    d.stored("n", "one two");
    expect(d.get("n")).toBeNull();
  });

  it("a refusal keeps the draft with its kind; not found takes it with the note", () => {
    const cases: [string, string | null][] = [
      ["stale_version", "mark"],
      ["cut", "mark"],
      ["locked", "locked"],
      ["forbidden", "copy"],
      ["archived", "copy"],
      ["invalid", null],
      ["unexpected", null],
    ];
    for (const [code, kind] of cases) {
      const d = new NoteDrafts();
      d.start("n", "mine", "old");
      d.refused("n", code);
      expect(d.get("n")).toEqual({ text: "mine", base: "old", sent: null, refusal: kind });
    }
    const d = new NoteDrafts();
    d.start("n", "mine", "old");
    d.refused("n", "not_found");
    expect(d.get("n")).toBeNull();
    expect(draftRefusal("not_found")).toBe("gone");
  });

  it("a conflict is a stale refusal while the stored text differs from the base; Keep mine starts on the newest", () => {
    const d = new NoteDrafts();
    d.start("n", "mine", "old");
    d.refused("n", "stale_version");
    expect(inConflict(d.get("n"), "old")).toBe(false); // "Not saved" until the fresh page brings the other text
    expect(inConflict(d.get("n"), "theirs")).toBe(true);
    d.start("n", "mine", "theirs");
    expect(d.get("n")!.base).toBe("theirs");
  });

  it("a save after Not saved keeps its base", () => {
    const d = new NoteDrafts();
    d.start("n", "mine", "old");
    d.refused("n", "cut");
    d.start("n", "mine", "old");
    expect(d.get("n")).toMatchObject({ base: "old", refusal: null, sent: "mine" });
  });

  it("text typed while a conflict shows is kept, not saved; drop and retain end drafts", () => {
    const d = new NoteDrafts();
    d.start("n", "mine", "old");
    d.refused("n", "stale_version");
    d.keepText("n", "mine, longer");
    expect(d.get("n")!.text).toBe("mine, longer");
    d.drop("n");
    expect(d.get("n")).toBeNull();
    d.start("a", "x", "");
    d.start("b", "y", "");
    d.retain(new Set(["b"]));
    expect(d.get("a")).toBeNull();
    expect(d.get("b")).not.toBeNull();
  });

  it("listeners hear only real changes, and a note's snapshot stays the same object while it does not change", () => {
    const d = new NoteDrafts();
    let heard = 0;
    d.subscribe(() => heard++);
    d.drop("none");
    d.stored("none", "x");
    expect(heard).toBe(0);
    d.start("a", "x", "");
    const a = d.get("a");
    d.start("b", "y", "");
    expect(d.get("a")).toBe(a);
    expect(heard).toBe(2);
  });
});

describe("onLeave: leaving a note's editor on the canvas", () => {
  it("saves a changed text, does nothing for the stored or the sent one", () => {
    expect(onLeave(null, "old", "old")).toBe("none");
    expect(onLeave(null, "new", "old")).toBe("save");
    expect(onLeave({ text: "new", base: "old", sent: "new", refusal: null }, "new", "old")).toBe("none");
    expect(onLeave({ text: "new", base: "old", sent: "new", refusal: null }, "newer", "old")).toBe("save");
  });

  it("keeps a conflict's draft without saving; saves again after Not saved; typed back to the stored text drops it", () => {
    const refused = { text: "mine", base: "old", sent: null, refusal: "mark" as const };
    expect(onLeave(refused, "mine", "theirs")).toBe("keep");
    expect(onLeave(refused, "mine", "old")).toBe("save");
    expect(onLeave(refused, "old", "old")).toBe("drop");
    expect(onLeave({ ...refused, refusal: "locked" }, "mine", "old")).toBe("save");
  });
});
