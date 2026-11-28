import { describe, expect, it } from "vitest";
import type { CatalogOrganization, CatalogWorkspace } from "@/domain/permissions";
import { parseItemRef } from "./item";
import { addressOf, stateOf } from "./address";
import { ALL_TAB } from "./search";
import { markText, scopeOptions, shownTabs } from "./view";

const ws = (id: string, name: string, over: Partial<CatalogWorkspace> = {}): CatalogWorkspace => ({ id, organizationId: "o", name, archived: false, infocube: false, hasRole: true, ...over });
const A = "01900000-0000-7000-8000-00000000000a";
const B = "01900000-0000-7000-8000-00000000000b";

describe("InfoCatalog's search page rules (slice 39, S39-03)", () => {
  it("words a mark", () => {
    expect(markText({ t: "pii" })).toEqual({ text: "Personal data", tone: "pii" });
    expect(markText({ t: "status", status: "review" })).toEqual({ text: "In review", tone: "plain" });
    expect(markText({ t: "status", status: "approved" }).text).toBe("Approved");
    expect(markText({ t: "missing" }).text).toBe("Missing");
    expect(markText({ t: "retired" }).text).toBe("Retired");
  });

  it("offers the whole organization, then each workspace, archived ones marked", () => {
    const org: CatalogOrganization = { id: "o", name: "InfoMate", workspaces: [ws(A, "Bank X", { archived: true }), ws(B, "Retail")] };
    expect(scopeOptions(org).map((o) => o.label)).toEqual(["Whole organization (2 workspaces)", "Workspace: Bank X · Archived", "Workspace: Retail"]);
    expect(scopeOptions({ ...org, workspaces: [ws(B, "Retail")] })[0]!.label).toBe("Whole organization (1 workspace)");
  });

  it("shows a module's tabs only where it is on in the scope", () => {
    const tabs = [{ key: "entities", label: "Entities", kinds: ["entity"] }, { key: "facts", label: "Facts", kinds: ["fact"], on: (w: CatalogWorkspace) => w.infocube }];
    expect(shownTabs(tabs, [ws(A, "a")]).map((t) => t.key)).toEqual(["entities"]);
    expect(shownTabs(tabs, [ws(A, "a"), ws(B, "b", { infocube: true })]).map((t) => t.key)).toEqual(["entities", "facts"]);
  });

  it("reads the state from the address leniently and writes only what differs", () => {
    expect(stateOf({}, "o")).toEqual({ org: "o", q: "", scope: null, kind: ALL_TAB, item: null });
    expect(stateOf({ q: "źródło", scope: A, kind: "attributes" }, "o")).toEqual({ org: "o", q: "źródło", scope: A, kind: "attributes", item: null });
    expect(stateOf({ q: ["a", "b"], scope: "not-an-id", kind: "<script>" }, "o")).toEqual({ org: "o", q: "", scope: null, kind: ALL_TAB, item: null });
    expect(stateOf({ q: "x".repeat(300) }, "o").q).toHaveLength(200);
    expect(addressOf({ org: "o", q: "", scope: null, kind: ALL_TAB, item: null })).toBe("/catalog?org=o");
    expect(addressOf({ org: "o", q: "customer address", scope: A, kind: "attributes", item: null })).toBe(`/catalog?org=o&q=customer+address&scope=${A}&kind=attributes`);
    // slice 39, step 6: an item's own address (C7); an odd reference is kept, so the page answers "not found"
    const item = `source_column:${A}:${A}`;
    expect(stateOf({ item }, "o").item).toBe(item);
    expect(addressOf({ org: "o", q: "", scope: null, kind: ALL_TAB, item })).toBe(`/catalog?org=o&item=${encodeURIComponent(item)}`);
    expect(stateOf({ item: "nonsense" }, "o").item).toBe("nonsense");
    expect(parseItemRef("nonsense")).toBeNull();
    expect(parseItemRef(item)).toEqual({ kind: "source_column", workspaceId: A, id: A });
  });
});
