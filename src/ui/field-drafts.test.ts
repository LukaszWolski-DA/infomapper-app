import { afterEach, describe, expect, it, vi } from "vitest";
import { dropDraft, isGone, keepDraft, markGone, takeDraft, unmarkGone, updateDraft } from "./field-drafts";

const at = (pathname: string) => vi.stubGlobal("window", { location: { pathname } });

describe("field drafts of closed panels (slice 13, item 5a)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gives a kept draft back once, on the page it was typed on", () => {
    at("/w/1/p/2/c/3");
    keepDraft("e1:name", { text: "Client", base: "Customer", refused: false });
    expect(updateDraft("e1:name", { refused: true })).toBe(true);
    expect(takeDraft("e1:name")).toEqual({ text: "Client", base: "Customer", refused: true });
    expect(takeDraft("e1:name")).toBeNull();
  });

  it("drops a draft typed on another page, and a stored one", () => {
    at("/w/1/p/2/c/3");
    keepDraft("e1:alias", { text: "Klient", base: "", refused: true });
    at("/w/1/p/2");
    expect(takeDraft("e1:alias")).toBeNull();
    at("/w/1/p/2/c/3");
    keepDraft("e1:alias", { text: "Klient", base: "", refused: false });
    dropDraft("e1:alias");
    expect(takeDraft("e1:alias")).toBeNull();
    expect(updateDraft("e1:alias", { refused: true })).toBe(false);
  });

  it("drops every draft of a deleted object, until a field of it mounts again", () => {
    at("/w/1/p/2/c/3");
    keepDraft("e2:name", { text: "Kunde", base: "Customer", refused: false });
    keepDraft("e2:alias", { text: "Klient", base: "", refused: false });
    keepDraft("e3:name", { text: "Order", base: "Sales Order", refused: false });
    markGone("e2:alias");
    expect(isGone("e2:name")).toBe(true);
    expect(takeDraft("e2:name")).toBeNull();
    expect(takeDraft("e2:alias")).toBeNull();
    expect(takeDraft("e3:name")).not.toBeNull();
    unmarkGone("e2:name");
    expect(isGone("e2:alias")).toBe(false);
  });
});
