import { describe, expect, it } from "vitest";
import { choiceLanded, choiceShown, FieldDraft, storedBy } from "./field-draft";

describe("FieldDraft (slice 13, D-66)", () => {
  it("takes a fresh stored value only without the focus and without a draft", () => {
    const d = new FieldDraft("Customer");
    expect(d.receive("Client", "Customer", false)).toBe("take"); // an undo, another person's write
    expect(d.taken).toBe("Client");
    expect(d.receive("Kunde", "Client", true)).toBe("keep"); // focused: the element keeps its text
    expect(d.receive("Kunde", "Client!", false)).toBe("keep"); // a draft
    expect(d.receive("Client!", "Client!", false)).toBe("end"); // the stored value came to equal the text
    expect(d.hasDraft("Client!")).toBe(false);
  });

  it("keeps text typed while a save is on its way, and saves the rest after it (S13-01)", () => {
    const d = new FieldDraft("Customer");
    expect(d.shouldSave("Customer 1", "Customer")).toBe(true);
    const n = d.send("Customer 1");
    // typed on: an Enter before the answer saves the rest, but the same text again saves nothing (F8)
    expect(d.shouldSave("Customer 1", "Customer")).toBe(false);
    // the answer's fresh page: the field has the focus and more text
    expect(d.receive("Customer 1", "Customer 12", true)).toBe("keep");
    d.answered(n, true);
    expect(d.shouldSave("Customer 12", "Customer 1")).toBe(true);
    expect(d.shouldSave("Customer 1", "Customer 1")).toBe(false);
  });

  it("compares with the stored value once the save is stored, whichever comes first, the answer or the page", () => {
    const answerFirst = new FieldDraft("a");
    answerFirst.answered(answerFirst.send("b"), true);
    expect(answerFirst.shouldSave("b", "a")).toBe(false); // the page is not there yet
    expect(answerFirst.receive("b", "b", false)).toBe("end");
    expect(answerFirst.shouldSave("a", "b")).toBe(true);

    const pageFirst = new FieldDraft("a");
    const n = pageFirst.send("b");
    expect(pageFirst.receive("b", "b", false)).toBe("end");
    pageFirst.answered(n, true);
    expect(pageFirst.shouldSave("a", "b")).toBe(true);
  });

  it("forgets the value sent when the server stored another one (trimmed, or a later write)", () => {
    const d = new FieldDraft("");
    d.answered(d.send("x"), true);
    expect(d.receive("X", "x", false)).toBe("keep"); // the element's text differs from what it was given
    expect(d.shouldSave("x", "X")).toBe(true);
  });

  it("keeps the text after any refusal, a cut included, and saves it again on leaving", () => {
    for (const code of ["invalid", "stale_version", "forbidden", "archived", "cut"]) {
      const d = new FieldDraft("Customer");
      const n = d.send("Client");
      d.answered(n, storedBy({ ok: false, code }));
      // the refusal's fresh page with a newer stored value: the draft stays
      expect(d.receive("Kunde", "Client", false)).toBe("keep");
      expect(d.shouldSave("Client", "Kunde")).toBe(true);
    }
  });

  it("lets only the newest save's refusal clear the value sent", () => {
    const d = new FieldDraft("a");
    const first = d.send("b");
    d.send("c");
    d.answered(first, false);
    expect(d.shouldSave("c", "a")).toBe(false);
  });

  it("puts a value back on the field's own request (an empty required name)", () => {
    const d = new FieldDraft("Customer");
    d.reset("Customer");
    expect(d.hasDraft("Customer")).toBe(false);
  });

  it("reads a save's answer", () => {
    expect(storedBy({ ok: true })).toBe(true);
    expect(storedBy({ ok: false, code: "cut" })).toBe(false);
    expect(storedBy(false)).toBe(false);
    expect(storedBy(undefined)).toBeUndefined();
    expect(storedBy(null)).toBeUndefined();
  });
});

describe("choiceLanded (slice 15b)", () => {
  it("is true once the stored value equals the choice, so an undo back to the old value shows it", () => {
    const chosen = { value: "hub", on: "entity" };
    expect(choiceLanded(chosen, "entity")).toBe(false); // on its way
    expect(choiceLanded(chosen, "hub")).toBe(true); // stored: forgotten, then an undo shows "entity"
    expect(choiceLanded(chosen, "link")).toBe(false); // another value: choiceShown shows it anyway
  });
});

describe("choiceShown (slice 13, R4)", () => {
  it("shows the choice until the stored value changes, then the stored value", () => {
    expect(choiceShown(null, "entity")).toBe("entity");
    expect(choiceShown({ value: "hub", on: "entity" }, "entity")).toBe("hub");
    expect(choiceShown({ value: "hub", on: "entity" }, "hub")).toBe("hub");
    expect(choiceShown({ value: "hub", on: "entity" }, "link")).toBe("link"); // another person's choice, after a refusal's fresh page
    expect(choiceShown({ value: true, on: false }, false)).toBe(true);
  });
});
