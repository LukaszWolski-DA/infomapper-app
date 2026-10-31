import { describe, expect, it } from "vitest";
import { attribute, canvasItem, entity, ids } from "@/domain/__fixtures__/domain";
import type { WorkspaceModel } from "@/domain/types";
import { applyNames, buildCards, shownText, type CanvasNames } from "./card-data";

// Slice 11 (F8): what an entity card shows under its canvas's names or aliases and its own exceptions.

const LONG = "Bardzo długa nazwa klienta do sprawdzenia skracania";
const model = (alias: string | null, attributeAlias: string | null): WorkspaceModel =>
  ({
    concepts: [],
    entities: [entity(ids.customer, { alias })],
    attributes: [attribute(ids.customerId, { alias: attributeAlias }), attribute(ids.email)],
    relationships: [],
    sourceSystems: [],
    sourceTables: [],
    sourceColumns: [],
    mappings: [],
    mappingInputs: [],
    sourceRelationships: [],
    sourceRelationshipColumns: [],
    classifications: [],
    classificationLinks: [],
    lostOriginals: [],
  }) as WorkspaceModel;
const names = (entity_names: CanvasNames["entity_names"], attribute_names: CanvasNames["attribute_names"]): CanvasNames => ({ entity_names, attribute_names });

describe("applyNames (slice 11)", () => {
  it("adds no data without aliases: no alias, no shown text, no exceptions", () => {
    const [card] = buildCards(model(null, null), [canvasItem()], undefined, null, [], names("alias", "alias"));
    expect(card).not.toHaveProperty("alias");
    expect(card).not.toHaveProperty("shown");
    expect(card).not.toHaveProperty("entityNames");
    expect(card!.rows.some((r) => "alias" in r || "shown" in r)).toBe(false);
  });

  it("shows aliases by the canvas's modes on the first paint, names where there is none, and keeps the names", () => {
    const [card] = buildCards(model("Klient", "Numer klienta"), [canvasItem()], undefined, null, [], names("alias", "alias"));
    expect(card).toMatchObject({ name: "Customer", alias: "Klient", shown: "Klient" });
    expect(card!.rows.map(shownText)).toEqual(["Numer klienta", "email"]);
    expect(card!.rows.map((r) => r.name)).toEqual(["customer_id", "email"]);
  });

  it("follows the card's exceptions, and returns the same card when nothing it shows changes", () => {
    const [plain] = buildCards(model("Klient", "Numer klienta"), [canvasItem(ids.itemCustomer, { entity_names: "alias" })], undefined, null, [], names(null, null));
    expect(plain).toMatchObject({ entityNames: "alias", shown: "Klient" });
    expect(plain!.rows.map(shownText)).toEqual(["customer_id", "email"]);
    expect(applyNames(plain!, names(null, null))).toBe(plain);
    const back = applyNames({ ...plain!, entityNames: undefined }, names(null, null));
    expect(back).not.toHaveProperty("shown");
  });

  it("works the clips out again for the text shown (D-37)", () => {
    const [card] = buildCards(model(LONG, null), [canvasItem(ids.itemCustomer, { width: 200 })], undefined, null, [], names(null, null));
    expect(card!.clipName).toBe(false);
    expect(applyNames(card!, names("alias", null)).clipName).toBe(true);
  });

  it("leaves table cards alone", () => {
    const src = { ...buildCards(model("Klient", null), [canvasItem()], undefined, null, [], names(null, null))[0]!, kind: "src" as const };
    expect(applyNames(src, names("alias", "alias"))).toBe(src);
  });
});
