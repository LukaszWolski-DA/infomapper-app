import { describe, expect, it } from "vitest";
import { access, attribute, canvasItem, entity, ids, makeCtx, mapping, mappingInput, relationship } from "@/domain/__fixtures__/domain";
import { deletedIds } from "@/domain/changes";
import { deleteAttribute } from "@/domain/commands/attribute";
import { deleteEntity } from "@/domain/commands/entity";
import { deleteMapping } from "@/domain/commands/mapping";
import { afterLasso, allKeys, cardKey, fromKeys, lassoHits, rectBetween, selectedCardIds, selectedKeys, selectionBounds, selectionDeleted, toggleCard, toggleItem, unitsOf, type ItemBox } from "./selection";

const cards: ItemBox[] = [
  { id: "c1", key: "entity:customer", rect: { x: 0, y: 0, w: 256, h: 200 } },
  { id: "c2", key: "entity:order", rect: { x: 400, y: 0, w: 256, h: 120 } },
  { id: "c3", key: "source:customers", rect: { x: 0, y: 400, w: 280, h: 300 } },
];

describe("selection keys (slice 2a)", () => {
  it("names an entity card and a source table card by their element", () => {
    expect(cardKey({ kind: "ent", targetId: "e1" })).toBe("entity:e1");
    expect(cardKey({ kind: "src", targetId: "t1" })).toBe("source:t1");
  });

  it("turns keys into no selection, one card, or several, keeping only cards on this canvas", () => {
    expect(fromKeys([], cards)).toBeNull();
    expect(fromKeys(["entity:customer", "entity:elsewhere"], cards)).toEqual({ t: "card", id: "c1" });
    expect(fromKeys(["entity:customer", "source:customers", "entity:customer"], cards)).toEqual({ t: "multi", keys: ["entity:customer", "source:customers"] });
  });

  it("reads the keys back from a selection; a row or a line holds no card", () => {
    expect(selectedKeys({ t: "card", id: "c2" }, cards)).toEqual(["entity:order"]);
    expect(selectedKeys({ t: "multi", keys: ["entity:order", "source:customers"] }, cards)).toEqual(["entity:order", "source:customers"]);
    expect(selectedKeys({ t: "row", cardId: "c1", id: "a1" }, cards)).toEqual([]);
    expect(selectedKeys(null, cards)).toEqual([]);
  });
});

describe("Shift+click", () => {
  it("adds a card to the selection and takes it out again", () => {
    const two = toggleCard({ t: "card", id: "c1" }, "c2", cards);
    expect(two).toEqual({ t: "multi", keys: ["entity:customer", "entity:order"] });
    const three = toggleCard(two, "c3", cards);
    expect(three).toEqual({ t: "multi", keys: ["entity:customer", "entity:order", "source:customers"] });
    expect(toggleCard(three, "c1", cards)).toEqual({ t: "multi", keys: ["entity:order", "source:customers"] });
    expect(toggleCard(two, "c2", cards)).toEqual({ t: "card", id: "c1" });
    expect(toggleCard({ t: "card", id: "c1" }, "c1", cards)).toBeNull();
  });

  it("starts from nothing when a row or a line was selected", () => {
    expect(toggleCard({ t: "map", id: "m1" }, "c2", cards)).toEqual({ t: "card", id: "c2" });
  });
});

describe("lasso (D-15, D-16)", () => {
  it("catches only cards fully inside, whichever way it was drawn", () => {
    const lasso = rectBetween({ x: 700, y: 250 }, { x: -10, y: -10 });
    expect(lasso).toEqual({ x: -10, y: -10, w: 710, h: 260 });
    expect(lassoHits(cards, lasso)).toEqual(["entity:customer", "entity:order"]);
    // c3 starts at y 400: partly inside is not enough
    expect(lassoHits(cards, { x: -10, y: -10, w: 710, h: 500 })).toEqual(["entity:customer", "entity:order"]);
    // touching the edges counts as inside
    expect(lassoHits(cards, { x: 0, y: 0, w: 256, h: 200 })).toEqual(["entity:customer"]);
  });

  it("replaces the selection, or adds to it when Shift was held at the start", () => {
    expect(afterLasso({ t: "card", id: "c3" }, ["entity:customer", "entity:order"], false, cards)).toEqual({ t: "multi", keys: ["entity:customer", "entity:order"] });
    expect(afterLasso({ t: "card", id: "c3" }, ["entity:customer"], true, cards)).toEqual({ t: "multi", keys: ["source:customers", "entity:customer"] });
    expect(afterLasso({ t: "card", id: "c3" }, [], false, cards)).toBeNull();
  });
});

describe("the selection box", () => {
  it("surrounds the selected cards 12 px out", () => {
    expect(selectionBounds([cards[0]!.rect, cards[1]!.rect])).toEqual({ x: -12, y: -12, w: 680, h: 224 });
    expect(selectionBounds([])).toBeNull();
  });
});

describe("frames in the selection (slice 2b, D-16, D-17)", () => {
  // frame F1 holds c1 and c2; frame F2 holds c4; c3 is in no frame
  const items: ItemBox[] = [
    { id: "F1", key: "frame:F1", rect: { x: -40, y: -40, w: 760, h: 300 } },
    { id: "F2", key: "frame:F2", rect: { x: 1000, y: 0, w: 400, h: 300 } },
    { id: "c1", key: "entity:customer", rect: { x: 0, y: 0, w: 256, h: 200 }, frameId: "F1" },
    { id: "c2", key: "entity:order", rect: { x: 400, y: 0, w: 256, h: 120 }, frameId: "F1" },
    { id: "c3", key: "source:customers", rect: { x: 0, y: 400, w: 280, h: 300 }, frameId: null },
    { id: "c4", key: "entity:line", rect: { x: 1040, y: 40, w: 256, h: 120 }, frameId: "F2" },
  ];

  it("one frame key is the single frame selection, and reads back", () => {
    expect(fromKeys(["frame:F1"], items)).toEqual({ t: "frame", id: "F1" });
    expect(selectedKeys({ t: "frame", id: "F2" }, items)).toEqual(["frame:F2"]);
    expect(fromKeys(["frame:gone", "entity:order"], items)).toEqual({ t: "card", id: "c2" });
  });

  it("Shift+click adds a frame to a card, or a card to a frame, and takes it out again", () => {
    const two = toggleItem({ t: "card", id: "c3" }, "frame:F1", items);
    expect(two).toEqual({ t: "multi", keys: ["source:customers", "frame:F1"] });
    expect(toggleItem(two, "frame:F1", items)).toEqual({ t: "card", id: "c3" });
    expect(toggleCard({ t: "frame", id: "F2" }, "c3", items)).toEqual({ t: "multi", keys: ["frame:F2", "source:customers"] });
  });

  it("a lasso around a whole frame catches the frame, not its cards; a frame partly inside is not caught", () => {
    expect(lassoHits(items, { x: -50, y: -50, w: 800, h: 800 })).toEqual(["frame:F1", "source:customers"]);
    // F1 not whole: its cards fully inside are caught on their own
    expect(lassoHits(items, { x: -10, y: -10, w: 700, h: 300 })).toEqual(["entity:customer", "entity:order"]);
  });

  it("a lasso does not catch a card hidden in a collapsed frame (slice 2c)", () => {
    const collapsed = items.map((i) => (i.id === "F2" ? { ...i, rect: { x: 1000, y: 0, w: 280, h: 118 } } : i.id === "c4" ? { ...i, hidden: true } : i));
    // around c4's place but not the whole block: neither the hidden card nor the frame
    expect(lassoHits(collapsed, { x: 1030, y: 30, w: 300, h: 200 })).toEqual([]);
    // around the whole block: the frame
    expect(lassoHits(collapsed, { x: 990, y: -10, w: 300, h: 200 })).toEqual(["frame:F2"]);
  });

  it("Ctrl+A selects every frame and the cards in no frame", () => {
    expect(allKeys(items)).toEqual(["frame:F1", "frame:F2", "source:customers"]);
  });

  it("units: a selected frame carries its cards, moved once even when also selected; other cards move alone", () => {
    expect(unitsOf(["frame:F1", "entity:order", "source:customers", "entity:line"], items)).toEqual({
      frames: ["F1"],
      cards: ["c3", "c4"],
      members: ["c1", "c2"],
      notes: [],
      reqs: [],
    });
  });

  it("the selected cards themselves, for fit widths, remove and put in a new frame", () => {
    expect(selectedCardIds(["frame:F1", "entity:order", "source:customers"], items)).toEqual(["c2", "c3"]);
  });
});

describe("notes in the selection (slice 3a, item 13, S3A-10)", () => {
  // frame F1 holds c1 and the free note n1; n2 is free in no frame; n3 is pinned to c3 (in no frame); n4 to F1;
  // n5 is pinned to c1 (in F1); n6 is free in no frame but hidden (resolved, hidden by the user)
  const items: ItemBox[] = [
    { id: "F1", key: "frame:F1", rect: { x: -40, y: -40, w: 760, h: 300 } },
    { id: "c1", key: "entity:customer", rect: { x: 0, y: 0, w: 256, h: 200 }, frameId: "F1" },
    { id: "c3", key: "source:customers", rect: { x: 0, y: 400, w: 280, h: 300 }, frameId: null },
    { id: "n1", key: "note:n1", rect: { x: 400, y: 20, w: 220, h: 90 }, frameId: "F1" },
    { id: "n2", key: "note:n2", rect: { x: 900, y: 400, w: 220, h: 90 }, frameId: null },
    { id: "n3", key: "note:n3", rect: { x: 304, y: 400, w: 220, h: 90 }, frameId: null, pinnedTo: "c3" },
    { id: "n4", key: "note:n4", rect: { x: 744, y: -40, w: 220, h: 90 }, frameId: null, pinnedTo: "F1" },
    { id: "n5", key: "note:n5", rect: { x: 280, y: 120, w: 220, h: 90 }, frameId: null, pinnedTo: "c1" },
  ];

  it("one note key is the single note selection, and reads back; Shift+click adds a note and takes it out", () => {
    expect(fromKeys(["note:n2"], items)).toEqual({ t: "note", id: "n2" });
    expect(selectedKeys({ t: "note", id: "n2" }, items)).toEqual(["note:n2"]);
    const two = toggleItem({ t: "note", id: "n2" }, "entity:customer", items);
    expect(two).toEqual({ t: "multi", keys: ["note:n2", "entity:customer"] });
    expect(toggleItem(two, "note:n2", items)).toEqual({ t: "card", id: "c1" });
    expect(toggleItem({ t: "card", id: "c3" }, "note:n3", items)).toEqual({ t: "multi", keys: ["source:customers", "note:n3"] });
  });

  it("a lasso catches a note fully inside it, not when its frame is caught too, nor a hidden one", () => {
    // around n1 only (F1 not whole): the note
    expect(lassoHits(items, { x: 390, y: 10, w: 240, h: 110 })).toEqual(["note:n1"]);
    // around all of F1: the frame stands for n1; the pinned notes inside are caught on their own
    expect(lassoHits(items, { x: -50, y: -50, w: 800, h: 320 })).toEqual(["frame:F1", "note:n5"]);
    expect(lassoHits([...items, { id: "n6", key: "note:n6", rect: { x: 900, y: 600, w: 220, h: 90 }, hidden: true }], { x: 890, y: 390, w: 240, h: 320 })).toEqual(["note:n2"]);
  });

  it("Ctrl+A also selects the free notes in no frame, not pinned ones or notes in frames", () => {
    expect(allKeys(items)).toEqual(["frame:F1", "source:customers", "note:n2"]);
  });

  it("units: a note moves once; a free note with its frame, a pinned note with its card or frame", () => {
    const keys = ["frame:F1", "source:customers", "note:n1", "note:n2", "note:n3", "note:n4", "note:n5"] as const;
    expect(unitsOf([...keys], items)).toEqual({ frames: ["F1"], cards: ["c3"], members: ["c1"], notes: ["n2"], reqs: [] });
    // nothing else moves: every note moves by itself
    expect(unitsOf(["note:n1", "note:n3", "note:n5"], items).notes).toEqual(["n1", "n3", "n5"]);
  });

  it("notes are not cards: fit widths, remove and put in a new frame leave them out", () => {
    expect(selectedCardIds(["note:n2", "source:customers", "frame:F1"], items)).toEqual(["c3"]);
  });
});

describe("requirement cards in the selection (slice 4b-2, L)", () => {
  const req: ItemBox = { id: "rc1", key: "req:r1", rect: { x: 800, y: 0, w: 230, h: 94 } };
  const frame: ItemBox = { id: "f1", key: "frame:f1", rect: { x: 700, y: -50, w: 600, h: 400 } };
  const all = [...cards, req, frame];

  it("one requirement key is the requirement selected; it reads back as its key while its card is here", () => {
    expect(fromKeys(["req:r1"], all)).toEqual({ t: "req", id: "r1" });
    expect(selectedKeys({ t: "req", id: "r1" }, all)).toEqual(["req:r1"]);
    expect(selectedKeys({ t: "req", id: "r2" }, all)).toEqual([]);
    expect(toggleCard({ t: "card", id: "c1" }, "rc1", all)).toEqual({ t: "multi", keys: ["entity:customer", "req:r1"] });
  });

  it("a lasso and Ctrl+A take requirement cards; a caught frame never stands for them; they move on their own", () => {
    expect(lassoHits(all, { x: 690, y: -60, w: 620, h: 420 })).toEqual(["frame:f1", "req:r1"]);
    expect(allKeys(all)).toContain("req:r1");
    expect(unitsOf(["frame:f1", "req:r1"], all)).toMatchObject({ frames: ["f1"], cards: [], reqs: ["rc1"] });
    expect(selectedCardIds(["entity:customer", "req:r1"], all)).toEqual(["c1"]);
  });
});

describe("the selection after a delete's answer (fix/selection-after-delete)", () => {
  // Customer (on two canvases) with two attributes, one mapped; Sales Order with one mapped attribute; a relationship
  // Customer – Sales Order and one Sales Order – Project A that does not touch Customer
  const { customer, salesOrder, itemCustomer, itemCrmCustomer } = ids;
  const itemCustomer2 = "01900000-0000-7000-8000-00000000c003";
  const itemOrder = "01900000-0000-7000-8000-00000000c004";
  const [email, phone] = [attribute(ids.email, { entity_id: customer, sort_order: 0 }), attribute("01900000-0000-7000-8000-000000005199", { entity_id: customer, sort_order: 1 })];
  const orderId = attribute(ids.orderId, { entity_id: salesOrder });
  const mapEmail = mapping({ id: "01900000-0000-7000-8000-00000000a101", attribute_id: email.id });
  const mapOrder = mapping({ id: "01900000-0000-7000-8000-00000000a104", attribute_id: orderId.id });
  const inputs = [mappingInput("01900000-0000-7000-8000-00000000b101", { mapping_id: mapEmail.id }), mappingInput("01900000-0000-7000-8000-00000000b104", { mapping_id: mapOrder.id })];
  const relCustomer = relationship();
  const relOther = relationship({ id: "01900000-0000-7000-8000-000000006003", from_entity_id: salesOrder, to_entity_id: ids.projectA });
  const items = [canvasItem(itemCustomer), canvasItem(itemCustomer2, { entity_id: customer }), canvasItem(itemCrmCustomer), canvasItem(itemOrder, { entity_id: salesOrder })];
  const links = { labelLinks: [], requirementLinks: [] };

  const gone = (r: { ok: true; writeSet: { writes: Parameters<typeof deletedIds>[0] } } | { ok: false }) => {
    if (!r.ok) throw new Error("refused");
    return new Set(deletedIds(r.writeSet.writes));
  };

  it("an entity's delete clears a selection of the entity, its cards, its attributes' rows, its mappings and its relationships", () => {
    const deleted = gone(
      deleteEntity(
        makeCtx(),
        access("modeler"),
        { entity: entity(customer), attributes: [email, phone, orderId], mappings: [mapEmail, mapOrder], mappingInputs: inputs, attributeInputs: [], relationships: [relCustomer, relOther], canvasItems: items, notes: [], ...links },
        { entityId: customer, expectedVersion: 1 },
      ),
    );
    expect(selectionDeleted({ t: "card", id: itemCustomer }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "card", id: itemCustomer2 }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "element", kind: "entity", id: customer }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "row", cardId: itemCustomer, id: phone.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "element", kind: "attribute", id: email.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "map", id: mapEmail.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "rel", id: relCustomer.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "multi", keys: [`entity:${salesOrder}`, `entity:${customer}`] }, deleted)).toBe(true);
    // what the person selected meanwhile, which the delete did not take along, stays
    expect(selectionDeleted({ t: "card", id: itemCrmCustomer }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "card", id: itemOrder }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "row", cardId: itemOrder, id: orderId.id }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "map", id: mapOrder.id }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "rel", id: relOther.id }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "multi", keys: [`entity:${salesOrder}`, `source:${ids.crmCustomer}`] }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "bundle", id: `${itemCustomer}|${itemOrder}` }, deleted)).toBe(false);
    expect(selectionDeleted(null, deleted)).toBe(false);
  });

  it("an attribute's delete clears its row and its mappings; its card, its entity and the other rows stay", () => {
    const deleted = gone(
      deleteAttribute(makeCtx(), access("modeler"), { attribute: email, mappings: [mapEmail, mapOrder], mappingInputs: inputs, attributeInputs: [], ...links }, { attributeId: email.id, expectedVersion: 1 }),
    );
    expect(selectionDeleted({ t: "row", cardId: itemCustomer, id: email.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "map", id: mapEmail.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "card", id: itemCustomer }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "element", kind: "entity", id: customer }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "row", cardId: itemCustomer, id: phone.id }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "map", id: mapOrder.id }, deleted)).toBe(false);
  });

  it("a mapping's delete clears only the mapping; a module's line is compared by its id as well", () => {
    const deleted = gone(deleteMapping(makeCtx(), access("modeler"), { mapping: mapEmail, inputs: [inputs[0]!], ...links }, { mappingId: mapEmail.id, expectedVersion: 1 }));
    expect(selectionDeleted({ t: "map", id: mapEmail.id }, deleted)).toBe(true);
    expect(selectionDeleted({ t: "row", cardId: itemCustomer, id: email.id }, deleted)).toBe(false);
    expect(selectionDeleted({ t: "ext", kind: "cube_mapping", id: "m-cube" }, new Set(["m-cube"]))).toBe(true);
    expect(selectionDeleted({ t: "ext", kind: "cube_mapping", id: "m-cube" }, deleted)).toBe(false);
  });

  it("nothing deleted clears nothing", () => {
    expect(selectionDeleted({ t: "card", id: itemCustomer }, new Set())).toBe(false);
  });
});
