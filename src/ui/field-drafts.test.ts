import { afterEach, describe, expect, it, vi } from "vitest";
import { dropDraft, keepDraft, takeDraft, updateDraft } from "./field-drafts";

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
});
