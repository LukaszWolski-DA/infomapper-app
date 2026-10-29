import type { Locator, Page } from "@playwright/test";
import { readDb, writeDb } from "../../src/data/local/file";
import { createMapping, updateMapping } from "../../src/domain/commands/mapping";
import { E2E_DB } from "../config";
import { FRAMED, dragCardBy, item, makeFrame, namePoint } from "../slice-02b/helpers";
import { labelsField, WHOLE_CO } from "../slice-03a/helpers";
import { openColumn, openList, openTable } from "../slice-07c/helpers";
import { expect, test } from "./fixtures";
import {
  asLukasz,
  canvasUrl,
  card,
  dragTo,
  ids,
  loadModel,
  mappingLine,
  menuOn,
  openCanvas,
  pointOnLine,
  recordToasts,
  RETAIL,
  rowNamed,
  signInAs,
  STALE,
  store,
  toasts,
  zoomOf,
} from "./helpers";

// The other writes on a row a panel field saves (item 1 c, d, e, g; F1), one case each, named after the action: a
// panel save of the row, then at once the write. Before slice 10a the write sent the version shown before the panel's
// save came back. Each case: stored, no false conflict.

async function open(page: Page, url = canvasUrl(), view?: { x: number; y: number; zoom: number }) {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, url, view);
}

async function typeAndLeave(field: Locator, value: string, key: "Enter" | "Tab" = "Enter") {
  await field.fill(value);
  await field.press(key);
}

const noConflict = async (page: Page) => expect(await toasts(page)).not.toContain(STALE);

/** A card on the page by its canvas item, so a rename does not lose it. */
const cardOf = async (page: Page, entityName: string) => page.locator(`.react-flow__node[data-id="${(await item(entityName)).id}"]`);

test("S10A-04: delete attribute (row menu), after its name in the panel", async ({ page }) => {
  const { entity } = await ids();
  const model = await loadModel();
  const a = model.attributes.find((x) => x.entity_id === entity("Order Line").id && !model.mappings.some((m) => m.attribute_id === x.id))!;
  await open(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  const row = card(page, "Order Line").locator(`.row[data-row="${a.id}"]`);
  await row.click();
  await typeAndLeave(page.getByTestId("input-attribute-name"), `${a.name}_x`);
  await menuOn(page, row, "Delete attribute");
  await expect.poll(async () => (await loadModel()).attributes.some((x) => x.id === a.id)).toBe(false); // the model leaves deleted rows out
  await noConflict(page);
});

test("S10A-04: add to mapping (D-48 drop), after the mapping's note in the panel", async ({ page }) => {
  const { attribute } = await ids();
  const first = attribute("Customer", "first_name");
  let model = await loadModel();
  const m = model.mappings.find((x) => x.attribute_id === first.id)!;
  await asLukasz((ctx, access) =>
    updateMapping(ctx, access, { mapping: m, inputs: model.mappingInputs.filter((i) => i.mapping_id === m.id) }, { mappingId: m.id, expectedVersion: m.version, kind: "transform", ruleExpression: "TRIM(fname)" }),
  );
  model = await loadModel();
  await open(page, canvasUrl(), { x: 0, y: -20, zoom: 0.8 });
  const at = await pointOnLine(mappingLine(page, m.id));
  await page.mouse.click(at.x, at.y);
  await typeAndLeave(page.getByTestId("panel-mapping").locator("#f-note"), "Checked with CRM", "Tab");
  await dragTo(page, rowNamed(page, "customers", "lname"), rowNamed(page, "Customer", "first_name"));
  const choice = page.getByTestId("popover-map-choice");
  await expect(choice.locator('[data-testid="option-map-choice"][aria-selected="true"]')).toHaveText("Add to mapping customers.fname");
  await page.keyboard.press("Enter");
  const { column } = await ids();
  await expect.poll(async () => (await loadModel()).mappingInputs.filter((i) => i.mapping_id === m.id && i.deleted_at === null).map((i) => i.source_column_id)).toContain(column("customers", "lname").id);
  expect((await loadModel()).mappings.find((x) => x.id === m.id)?.note_text).toBe("Checked with CRM");
  await noConflict(page);
});

test("S10A-04: move to the frame's concept (frame panel), after the entity's name in its panel", async ({ page }) => {
  await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area", concept: "Sales" }); // Customer, misplaced
  await open(page, canvasUrl(), FRAMED);
  const customer = (await ids()).entity("Customer");
  await card(page, "Customer").getByTestId("card-name").click();
  await typeAndLeave(page.getByTestId("input-entity-name"), "Client");
  const at = await namePoint(page, "Area");
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("button-frame-move-entity").click();
  const sales = (await loadModel()).concepts.find((c) => c.name === "Sales")!;
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)).toMatchObject({ name: "Client", concept_id: sales.id });
  await noConflict(page);
});

test("S10A-04: merge mappings (mapping panel), after the mapping's note", async ({ page }) => {
  const { attribute, column } = await ids();
  const number = attribute("Customer", "customer_number");
  const model = await loadModel();
  const m = model.mappings.find((x) => x.attribute_id === number.id)!;
  await asLukasz((ctx, access) =>
    createMapping(ctx, access, { attribute: number, column: column("web_users", "cust_no"), mappings: model.mappings, mappingInputs: model.mappingInputs }, { attributeId: number.id, sourceColumnId: column("web_users", "cust_no").id }),
  );
  await open(page, `${canvasUrl()}?map=${m.id}`);
  const panel = page.getByTestId("panel-mapping");
  await typeAndLeave(panel.locator("#f-note"), "Two sources", "Tab");
  await panel.getByTestId("button-merge-mappings").click();
  await panel.getByTestId("check-merge-mapping").first().check();
  await panel.getByTestId("input-merge-rule").fill("COALESCE(customers.cust_no, web_users.cust_no)");
  await panel.getByTestId("button-merge").click();
  await expect.poll(async () => (await loadModel()).mappings.filter((x) => x.attribute_id === number.id && x.deleted_at === null).length).toBe(1);
  expect((await loadModel()).mappings.find((x) => x.id === m.id)).toMatchObject({ note_text: "Two sources", kind: "transform" });
  await noConflict(page);
});

test("S10A-04: delete from model (card menu), after the entity's name in its panel", async ({ page }) => {
  const customer = (await ids()).entity("Customer");
  await open(page);
  const node = await cardOf(page, "Customer");
  await node.getByTestId("card-name").click();
  await typeAndLeave(page.getByTestId("input-entity-name"), "Client");
  await menuOn(page, node.locator(".c-head"), "Delete from model…");
  await page.getByTestId("button-confirm-delete-entity").click();
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.id === customer.id)).toBe(false);
  await noConflict(page);
});

test("S10A-04: mark as needed (column panel), between two saves of the column's note", async ({ page }) => {
  const segment = (await ids()).column("customers", "segment");
  const db = await readDb(E2E_DB);
  db.source_column = db.source_column.map((c) => (c.id === segment.id ? { ...c, not_needed: true } : c));
  await writeDb(E2E_DB, db);
  await recordToasts(page);
  await openColumn(page, "customers", "segment");
  const note = page.getByTestId("input-source-note");
  await typeAndLeave(note, "Used by marketing", "Tab");
  await page.getByTestId("button-mark-needed").click();
  await typeAndLeave(note, "Used by marketing and sales", "Tab");
  await expect.poll(async () => (await loadModel()).sourceColumns.find((c) => c.id === segment.id)).toMatchObject({ not_needed: false, note_text: "Used by marketing and sales" });
  await noConflict(page);
});

test("S10A-04: delete a source table (table panel), after the table's note", async ({ page }) => {
  const table = (await ids()).table("web_users");
  await recordToasts(page);
  await openTable(page, "web_users", "cust_no");
  const panel = page.getByTestId("panel-source-table");
  await typeAndLeave(panel.getByTestId("input-source-note"), "Retired next year", "Tab");
  await panel.getByTestId("button-delete-table").click();
  await panel.getByTestId("button-delete-confirm").click();
  await expect.poll(async () => (await loadModel()).sourceTables.some((t) => t.id === table.id)).toBe(false);
  await noConflict(page);
});

test("S10A-04: delete a working label (label panel), after its name", async ({ page }) => {
  await open(page, canvasUrl(), WHOLE_CO);
  await card(page, "Customer").getByTestId("card-name").click();
  await labelsField(page).getByTestId("button-label-open").filter({ hasText: "CR-23" }).click();
  await typeAndLeave(page.getByTestId("input-label-name"), "CR-24");
  await page.getByTestId("button-label-delete").click();
  await expect.poll(async () => (await store().labels.list(RETAIL)).some((l) => l.name === "CR-24" || l.name === "CR-23")).toBe(false);
  await noConflict(page);
});

test("S10A-04: remove and restore a classification (list dialog), between saves of its name", async ({ page }) => {
  await recordToasts(page);
  await openColumn(page, "customers", "cust_no");
  await openList(page);
  const dialog = page.getByTestId("dialog-classifications");
  const row = dialog.locator('[data-testid="classification-row"][data-code="LDTS"]');
  await typeAndLeave(row.getByTestId("input-classification-name"), "Load time A");
  await row.getByTestId("button-remove-classification").click();
  const confirm = dialog.getByTestId("button-confirm-remove-classification");
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await dialog.getByTestId("removed-classification").filter({ hasText: "Load time A" }).getByTestId("button-restore-classification").click();
  await typeAndLeave(row.getByTestId("input-classification-name"), "Load time B");
  await expect.poll(async () => (await loadModel()).classifications.find((c) => c.code === "LDTS")).toMatchObject({ name: "Load time B", deleted_at: null });
  await noConflict(page);
});

test("S10A-04: delete a concept with “move to” (left panel), after its name, then a moved entity's name", async ({ page }) => {
  const model = await loadModel();
  const concept = model.concepts.find((c) => c.name === "Customer")!;
  const sales = model.concepts.find((c) => c.name === "Sales")!;
  const customer = (await ids()).entity("Customer");
  await open(page);
  const tree = page.locator(`[data-testid="tree-concept"][data-concept-id="${concept.id}"]`);
  await tree.getByTestId("tree-concept-head").dblclick();
  await typeAndLeave(tree.getByTestId("input-tree-name"), "Clients");
  await tree.getByTestId("button-concept-menu").click();
  await page.getByRole("menuitem", { name: "Delete concept…" }).click();
  const dialog = page.getByTestId("dialog-delete-concept");
  await dialog.getByTestId("select-move-to").selectOption({ label: "Sales" });
  await dialog.getByTestId("button-confirm-delete-concept").click();
  await (await cardOf(page, "Customer")).getByTestId("card-name").click();
  await typeAndLeave(page.getByTestId("input-entity-name"), "Client");
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)).toMatchObject({ name: "Client", concept_id: sales.id });
  expect((await loadModel()).concepts.some((c) => c.id === concept.id)).toBe(false);
  await noConflict(page);
});

test("S10A-04: archive and unarchive (workspace home), after the workspace's name in the settings, then the name again", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}?tab=settings`);
  const name = page.getByTestId("input-workspace-name");
  await typeAndLeave(name, "Retail Co – DWH 2026");
  // the archive box is on the Overview tab: switched inside the page, so the settings save may still be on its way
  await page.getByTestId("tab-overview").click();
  await page.getByTestId("button-archive").click();
  await expect.poll(async () => (await store().workspaces.get(RETAIL))?.archived_at ?? null).not.toBeNull();
  await page.getByTestId("button-unarchive").click();
  await page.getByTestId("tab-settings").click();
  await expect(name).toBeEnabled();
  await typeAndLeave(name, "Retail Co – DWH 2027");
  await expect.poll(async () => store().workspaces.get(RETAIL)).toMatchObject({ name: "Retail Co – DWH 2027", archived_at: null });
  await noConflict(page);
});

test("S10A-04: a drop into another concept's frame with “Move to …” (D-05), then at once the entity's name in its panel", async ({ page }) => {
  await makeFrame({ x: 880, y: 0, width: 600, height: 480 }, { name: "Customers", concept: "Customer" });
  const salesOrder = (await ids()).entity("Sales Order");
  const customerConcept = (await loadModel()).concepts.find((c) => c.name === "Customer")!;
  await open(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);
  await dragCardBy(page, "Sales Order", 408 * zoom, -528 * zoom);
  await page.getByTestId("button-concept-move").click();
  await (await cardOf(page, "Sales Order")).getByTestId("card-name").click();
  await typeAndLeave(page.getByTestId("input-entity-name"), "Order");
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === salesOrder.id)).toMatchObject({ name: "Order", concept_id: customerConcept.id });
  await noConflict(page);
});
