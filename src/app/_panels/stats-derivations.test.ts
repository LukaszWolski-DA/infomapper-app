// Slice 18 (item 2, F1; Łukasz, step 4): every place that shows a row as mapped or fed agrees with the row's square:
// the card's count, the Mapped and Not mapped filters, the Overview, the status bar, the project home and the thumbnails.

import { describe, expect, it } from "vitest";
import { buildCards } from "@/canvas/card-data";
import { attribute, canvasItem, concept, entity, ids, mapping, mappingInput, sourceColumn, sourceSystem, sourceTable } from "@/domain/__fixtures__/domain";
import { rowShown } from "@/domain/model/card-size";
import { thumbnailIndex } from "@/domain/model/thumbnail";
import type { AttributeInput, WorkspaceModel } from "@/domain/types";
import { indexModel } from "./model-index";
import { canvasStatus, coverage, projectStats } from "./stats";

const full = "01900000-0000-7000-8000-0000000053a1";
const gap = "01900000-0000-7000-8000-0000000053a2";
const T = "2026-11-08T10:00:00.000Z";
const input = (attribute_id: string, input_attribute_id: string, id: string): AttributeInput => ({
  id,
  workspace_id: ids.ws,
  attribute_id,
  input_attribute_id,
  sort_order: 0,
  version: 1,
  created_at: T,
  created_by: ids.actor,
  updated_at: T,
  updated_by: ids.actor,
  deleted_at: null,
});

// Customer: customer_id (no mapping), email (mapped), full (= email: its square filled), gap (= customer_id: hollow)
const model: WorkspaceModel = {
  concepts: [concept()],
  entities: [entity(ids.customer)],
  attributes: [
    attribute(ids.customerId),
    attribute(ids.email),
    attribute(full, { name: "full", is_primary_key: false, is_calculated: true }),
    attribute(gap, { name: "gap", is_primary_key: false, is_calculated: true }),
  ],
  relationships: [],
  sourceSystems: [sourceSystem()],
  sourceTables: [sourceTable()],
  sourceColumns: [sourceColumn(ids.colEmail)],
  mappings: [mapping()],
  mappingInputs: [mappingInput()],
  attributeInputs: [input(full, ids.email, "01900000-0000-7000-8000-0000000053b1"), input(gap, ids.customerId, "01900000-0000-7000-8000-0000000053b2")],
  sourceRelationships: [],
  sourceRelationshipColumns: [],
  classifications: [],
  classificationLinks: [],
  lostOriginals: [],
};

describe("mapped through a calculation agrees with the row's square (slice 18, F1)", () => {
  it("the card: its rows' squares, its count and its filters", () => {
    const [card] = buildCards(model, [canvasItem(ids.itemCustomer)]);
    const row = (id: string) => card!.rows.find((r) => r.id === id)!;
    expect(row(full).calc).toEqual({ rule: null, square: "ok" });
    expect(row(gap).calc).toEqual({ rule: null, square: "gap" });
    expect(row(ids.email).calc).toBeUndefined();
    // email and full count; customer_id and gap do not
    expect(card!.mapped).toBe(2);
    expect(card!.rows.filter((r) => rowShown(r, "mapped")).map((r) => r.id)).toEqual([ids.email, full]);
    expect(card!.rows.filter((r) => rowShown(r, "unmapped")).map((r) => r.id)).toEqual([ids.customerId, gap]);
  });

  it("the Overview, the status bar and the project home count the same", () => {
    const ix = indexModel(model);
    expect(coverage(ix, [ids.customer])[0]).toMatchObject({ attributes: 4, mapped: 2 });
    expect(canvasStatus(ix, [ids.customer])).toMatchObject({ attributes: 4, mapped: 2 });
    expect(projectStats(model, [canvasItem(ids.itemCustomer)], [ids.canvas1])).toMatchObject({ attributes: 4, mapped: 2 });
  });

  it("the thumbnails' rows have the same squares, so a Mapped filter keeps the card's height", () => {
    const ix = thumbnailIndex(model, { requirements: [], labels: [], labelLinks: [] });
    const rows = ix.rowsOfEntity.get(ids.customer)!;
    expect(rows.filter((r) => rowShown(r, "mapped")).map((r) => r.id)).toEqual([ids.email, full]);
  });

  it("a calculation's inputs fed by a module count for a fact's or a dimension's Overview", () => {
    const ix = indexModel(model);
    const fed = coverage(ix, [ids.customer], { roles: { [ids.customer]: { text: "Fact", feed: { word: "fed", title: "t", list: "l", none: "no feed" } } as never }, rowFeeds: { [ids.customerId]: { n: 1, title: "", list: "" } } });
    // customer_id fed, so gap (= customer_id) counts; email not fed, so full does not
    expect(fed[0]).toMatchObject({ attributes: 4, mapped: 2 });
  });
});
