// S35-03 (slice 35, criterion 3; B1.4, the design of 11 November 2026): what a baseline holds never changes after it is
// taken. A baseline is taken in the page, then the model changes (an entity renamed, an attribute's type, a mapping
// approved, an entity deleted, an import, and an undo and a redo of some of it); "Compare…" with Now shows exactly those
// changes and the list's counts stay; a rename of the baseline changes only its name and note (the same comparison
// before and after). The content is its own file and holds what the design lists, without labels, notes or people.
// The demo without the star ("docs"): deleting an entity needs no InfoCube cascade here.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures";
import { UNDO_TABLES } from "../../src/compose/tables";
import { baselineFolder } from "../../src/data/local/file";
import { CHANGE_KINDS, compareBaselines } from "../../src/domain/baseline/compare";
import type { BaselineContent } from "../../src/domain/baseline/content";
import { COMPARE_WORDS, whatChanged } from "../../src/domain/baseline/words";
import { updateAttribute } from "../../src/domain/commands/attribute";
import { deleteEntity, updateEntity } from "../../src/domain/commands/entity";
import { importSources, importStateOf } from "../../src/domain/commands/import";
import { setMappingStatus } from "../../src/domain/commands/mapping";
import { revertChangeGroup } from "../../src/domain/commands/undo";
import { planFingerprint } from "../../src/domain/import/compare";
import { buildPlan } from "../../src/domain/import/plan";
import { readStandard } from "../../src/domain/import/standard";
import { baselineContentNow } from "../../src/compose/baselines";
import { E2E_DB } from "../config";
import { sample } from "../slice-07a/helpers";
import { asPersonHere, compareRows, composedStore, createInBox, expectToast, openBaselines, openCompare, renameDialog, RETAIL, rowNamed, SEED_IDS, signInAs, storedBaseline } from "./helpers";

test.use({ seed: "docs" });

const ANNA = SEED_IDS.userAnna;
const W = COMPARE_WORDS.en;

test("S35-03: a baseline's content never changes: model edits, an import, undo and redo, its own rename", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await createInBox(page, "Before the changes");
  await expectToast(page, "Created the baseline Before the changes.");
  const taken = (await storedBaseline("Before the changes"))!;
  const file = path.join(baselineFolder(E2E_DB), `${taken.id}.json`);
  const stored = fs.readFileSync(file, "utf8");
  const content = JSON.parse(stored) as Record<string, unknown>;
  // what it holds and what it leaves out
  expect(Object.keys(content).sort()).toEqual(["canvasItems", "canvases", "frames", "model", "modules", "projectCanvases", "projects", "requirementLinks", "requirements", "settings"]);
  expect(Object.keys(content.settings as object).sort()).toEqual(["dv2_mode", "four_eyes", "infocube", "naming_conventions"]);
  for (const left of ["labels", "labelLinks", "notes", "members", "people", "organization", "workspace"]) expect(content, left).not.toHaveProperty(left);
  const meta = await rowNamed(page, "Before the changes").getByTestId("baseline-meta").textContent();

  // the model changes, as Anna
  const s = composedStore();
  let m = await s.model.load(RETAIL);
  const product = m.entities.find((e) => e.name === "Product")!;
  // a rename, undone and redone (renamed again)
  let renamed: Parameters<typeof revertChangeGroup>[2]["events"] = [];
  await asPersonHere(ANNA, (ctx, access) => {
    const r = updateEntity(ctx, access, { entity: product, entities: m.entities, concept: null, stereotypes: m.stereotypes }, { entityId: product.id, expectedVersion: product.version, name: "Article" });
    if (r.ok) renamed = r.writeSet.events;
    return r;
  });
  await revert(await revert(renamed, "undo"), "redo");
  const customer = m.entities.find((e) => e.name === "Customer")!;
  const email = m.attributes.find((a) => a.entity_id === customer.id && a.name === "email")!;
  await asPersonHere(ANNA, (ctx, access) => updateAttribute(ctx, access, { attribute: email }, { attributeId: email.id, expectedVersion: email.version, type: { length: 200 } }));
  const review = m.mappings.find((x) => x.status === "review")!;
  await asPersonHere(SEED_IDS.userLukasz, (ctx, access) => setMappingStatus(ctx, access, { mapping: review, contentAuthorId: ANNA }, { mappingId: review.id, expectedVersion: review.version, status: "approved" }));
  // an entity deleted; another deleted and undone (back as it was)
  m = await s.model.load(RETAIL);
  const order = m.entities.find((e) => e.name === "Sales Order")!;
  await deleteWithEvents(order.id);
  m = await s.model.load(RETAIL);
  const line = m.entities.find((e) => e.name === "Order Line")!;
  await revert(await deleteWithEvents(line.id), "undo");
  // an import into a new system
  const text = sample("crm_snapshot_2026-10-20.csv");
  const read = readStandard(text, "crm.csv");
  const state = importStateOf(await s.model.load(RETAIL), await s.model.listChanges(RETAIL));
  const target = { newName: "CRM 2" };
  const scope = read.tables.map((t) => t.key);
  const plan = buildPlan(state.model, read, target, { scope: new Set(scope), compare: "schemas", renames: new Map() });
  await asPersonHere(ANNA, (ctx, access) =>
    importSources(ctx, access, state, { target, channel: "file", sourceLabel: "crm.csv", text, scope, compare: "schemas", renames: [], fingerprint: planFingerprint(plan) }),
  );

  // the content is the same file, unchanged; the list's counts stay
  expect(fs.readFileSync(file, "utf8")).toBe(stored);
  await page.reload();
  await expect(rowNamed(page, "Before the changes").getByTestId("baseline-meta")).toHaveText(meta!);

  // Compare… with Now shows exactly those changes: the dialog's rows are the comparison of the stored content with now
  const now = (await baselineContentNow(s, RETAIL))!;
  // the dialog groups them: Added, Changed, Removed, each in the kinds' order
  const all = compareBaselines(content as unknown as BaselineContent, now);
  const expected = CHANGE_KINDS.flatMap((ch) => all.filter((c) => c.change === ch)).map((c) => `${W.kinds[c.kind]} | ${c.label} | ${whatChanged(c, W)}`);
  let dialog = await openCompare(page, "Before the changes");
  const shown = await compareRows(dialog);
  expect(shown).toEqual(expected);
  expect(shown).toContain("Entity | Article | name: Product → Article");
  expect(shown).toContain(`Attribute | Customer.email | type: string(${email.type_length}) → string(200)`);
  expect(shown.filter((r) => r.startsWith("Mapping |") && r.endsWith("status: In review → Approved"))).toHaveLength(1);
  expect(shown).toContain("Entity | Sales Order | ");
  expect(shown.some((r) => r.startsWith("Entity | Order Line"))).toBe(false);
  expect(shown.some((r) => r.startsWith("Source table | CRM 2 · "))).toBe(true);
  await expect(dialog.getByTestId("compare-group-added")).toBeVisible();
  await expect(dialog.getByTestId("compare-group-changed")).toBeVisible();
  await expect(dialog.getByTestId("compare-group-removed")).toBeVisible();
  await dialog.getByTestId("button-close-compare").click();

  // a rename changes only the name and the note: the same comparison after it
  await rowNamed(page, "Before the changes").getByTestId("button-baseline-rename").click();
  await renameDialog(page).getByLabel("Name").fill("Before, renamed");
  await renameDialog(page).getByLabel("Note (optional)").fill("Renamed after the changes.");
  await renameDialog(page).getByTestId("button-save-rename-baseline").click();
  await expectToast(page, "Renamed the baseline Before the changes to Before, renamed.");
  expect(fs.readFileSync(file, "utf8")).toBe(stored);
  dialog = await openCompare(page, "Before, renamed");
  expect(await compareRows(dialog)).toEqual(shown);

  /** An entity deleted as Anna; the write's change events, for the undo. */
  async function deleteWithEvents(entityId: string) {
    const model = await s.model.load(RETAIL);
    const entity = model.entities.find((e) => e.id === entityId)!;
    const items = await s.canvasItems.list(RETAIL);
    let events: Parameters<typeof revertChangeGroup>[2]["events"] = [];
    await asPersonHere(ANNA, (ctx, access) => {
      const r = deleteEntity(ctx, access, { ...model, entity, canvasItems: items }, { entityId, expectedVersion: entity.version });
      if (r.ok) events = r.writeSet.events;
      return r;
    });
    return events;
  }
  /** Undo or redo of a change group, as the server's undo writes it. */
  async function revert(events: Parameters<typeof revertChangeGroup>[2]["events"], mode: "undo" | "redo") {
    let out: typeof events = [];
    const rows = await s.model.loadForUndo(RETAIL);
    await asPersonHere(ANNA, (ctx, access) => {
      const r = revertChangeGroup(ctx, access, { events, rows }, mode, UNDO_TABLES);
      if (r.ok) out = r.writeSet.events;
      return r;
    });
    return out;
  }
});
