import { describe, expect, it } from "vitest";
import { ids, requirementLink, T0 } from "@/domain/__fixtures__/domain";
import { DROP_TOAST, dropHint, dropTargetAt, isLinkedTo, sameDropTarget, type DropLookup } from "./requirement-drop";

/** A stand-in for the element under the pointer: what `closest` finds for each selector, and `contains`. */
const fake = (found: { card?: object; row?: object; mapping?: object }) => {
  const el = {
    closest: (sel: string) => (sel.includes(".card.ent") ? (found.card ?? null) : sel.includes(".row") ? (found.row ?? null) : sel.includes("data-mapping") ? (found.mapping ?? null) : null),
  };
  return el as unknown as Element;
};
const cardEl = (id: string, row?: object) => ({ dataset: { card: id }, contains: (x: unknown) => x === row });

const links = [
  requirementLink("01900000-0000-7000-8000-00000000e301", { requirement_id: ids.req101, attribute_id: ids.email }),
  requirementLink("01900000-0000-7000-8000-00000000e302", { requirement_id: ids.req101, attribute_id: null, entity_id: ids.salesOrder, deleted_at: T0 }),
];
const lookup = (over: Partial<DropLookup> = {}): DropLookup => ({
  card: (id) => (id === "c-cust" ? { kind: "ent", targetId: ids.customer, name: "Customer", rowName: (r) => (r === ids.email ? "email" : undefined) } : null),
  mappingName: (id) => (id === ids.mapEmail ? "customers.email_addr → Customer.email" : null),
  links,
  hasCard: false,
  ...over,
});

describe("dropTargetAt (slice 4b-2, item 17)", () => {
  it("a row links to its attribute, “already linked” when it is", () => {
    const row = { dataset: { row: ids.email } };
    expect(dropTargetAt(fake({ card: cardEl("c-cust", row), row }), lookup())).toMatchObject({ t: "row", target: { kind: "attribute", id: ids.email }, name: "email", linked: true });
  });

  it("a card (not on a row) links to its entity; a deleted link does not count", () => {
    expect(dropTargetAt(fake({ card: cardEl("c-cust") }), lookup())).toMatchObject({ t: "card", target: { kind: "entity", id: ids.customer }, name: "Customer", linked: false });
  });

  it("a mapping line links to the mapping", () => {
    expect(dropTargetAt(fake({ mapping: { dataset: { mapping: ids.mapEmail } } }), lookup())).toMatchObject({ t: "map", target: { kind: "mapping", id: ids.mapEmail }, name: "customers.email_addr → Customer.email" });
  });

  it("anything else places the card, or moves it when it is here", () => {
    expect(dropTargetAt(null, lookup())).toEqual({ t: "place", move: false });
    expect(dropTargetAt(fake({}), lookup({ hasCard: true }))).toEqual({ t: "place", move: true });
    // a card the canvas does not know (a block, a requirement card) is a place too
    expect(dropTargetAt(fake({ card: cardEl("c-other") }), lookup())).toEqual({ t: "place", move: false });
  });
});

describe("hints, toasts and the store's equality (items 18–19)", () => {
  it("names what a drop does", () => {
    const t = { target: { kind: "attribute" as const, id: ids.email }, cardId: "c", rowId: ids.email, name: "birth_date" };
    expect(dropHint({ t: "row", ...t, linked: false })).toBe("Link to birth_date");
    expect(dropHint({ t: "row", ...t, linked: true })).toBe("Already linked to birth_date");
    expect(dropHint({ t: "place", move: false })).toBe("Place card");
    expect(dropHint({ t: "place", move: true })).toBe("Move card");
    expect(DROP_TOAST.linked("REQ-103", "email")).toBe("Linked REQ-103 to email.");
    expect(DROP_TOAST.already("REQ-103", "email")).toBe("REQ-103 is already linked to email.");
    expect(DROP_TOAST.placed("REQ-101")).toBe("Placed REQ-101 on this canvas. Dashed lines show what it traces to.");
  });

  it("the same target twice is no change; isLinkedTo reads live links only", () => {
    const a = { t: "card" as const, cardId: "c", target: { kind: "entity" as const, id: ids.customer }, name: "Customer", linked: false };
    expect(sameDropTarget(a, { ...a })).toBe(true);
    expect(sameDropTarget(a, { ...a, linked: true })).toBe(false);
    expect(sameDropTarget({ t: "place", move: false }, { t: "place", move: false })).toBe(true);
    expect(sameDropTarget(null, null)).toBe(true);
    expect(sameDropTarget(a, null)).toBe(false);
    expect(isLinkedTo(links, { kind: "entity", id: ids.salesOrder })).toBe(false);
  });
});
