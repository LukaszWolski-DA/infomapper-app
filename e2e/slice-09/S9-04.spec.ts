import type { Locator, Page } from "@playwright/test";
import { columnId, openColumn, openList } from "../slice-07c/helpers";
import { expect, test } from "./fixtures";
import {
  canvasUrl,
  card,
  loadModel,
  loadNotes,
  openCanvas,
  openRequirement,
  pointOnLine,
  recordToasts,
  requirementByKey,
  RETAIL,
  store,
  rowNamed,
  signInAs,
  toasts,
} from "./helpers";

// Every kind of panel that saves with a row's version (Q1): a second save of the same row right after the first is
// stored, without a toast. Each case starts both saves before the page shows the first one's version.

async function open(page: Page, url = canvasUrl(), view?: { x: number; y: number; zoom: number }) {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, url, view);
}

/** Types into a text field and leaves it with Enter (inputs) or Tab (text areas), which saves it. */
async function typeAndLeave(field: Locator, value: string, key: "Enter" | "Tab" = "Enter") {
  await field.fill(value);
  await field.press(key);
}

/** The pressed button of a segmented control, then another one. */
async function pressOther(seg: Locator): Promise<string> {
  const other = seg.locator('button[aria-pressed="false"]').first();
  const label = (await other.textContent()) ?? "";
  await other.click();
  return label;
}

test("S9-04: attribute: the name, then a flag", async ({ page }) => {
  await open(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  await rowNamed(page, "Order Line", "unit_price").click();
  await typeAndLeave(page.getByTestId("input-attribute-name"), "unit_price_eur");
  await page.getByTestId("flags-attribute").getByRole("button", { name: "Personal data" }).click();
  await expect.poll(async () => (await loadModel()).attributes.find((a) => a.name === "unit_price_eur")?.is_pii).toBe(true);
  expect(await toasts(page)).toEqual([]);
});

test("S9-04: entity: the name, then the stereotype", async ({ page }) => {
  await open(page);
  await card(page, "Customer").getByTestId("card-name").click();
  await typeAndLeave(page.getByTestId("input-entity-name"), "Client");
  const stereotype = page.getByTestId("select-entity-stereotype");
  const next = await stereotype.locator("option:not(:checked)").first().getAttribute("value");
  await stereotype.selectOption(next!);
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.name === "Client")?.stereotype).toBe(next);
  expect(await toasts(page)).toEqual([]);
});

test("S9-04: mapping: the note, then the status", async ({ page }) => {
  const mapping = (await loadModel()).mappings.find((m) => m.status === "draft" && m.deleted_at === null)!;
  await open(page, `${canvasUrl()}?map=${mapping.id}`);
  const panel = page.getByTestId("panel-mapping");
  await typeAndLeave(panel.locator("#f-note"), "Checked with Finance", "Tab");
  await panel.getByTestId("seg-mapping-status").getByRole("button", { name: "In review" }).click();
  await expect.poll(async () => (await loadModel()).mappings.find((m) => m.id === mapping.id)).toMatchObject({ note_text: "Checked with Finance", status: "review" });
  expect(await toasts(page)).toEqual([]);
});

test("S9-04: relationship: the label, then a cardinality", async ({ page }) => {
  await open(page);
  const line = page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').first();
  const id = (await line.getAttribute("data-relationship"))!;
  const before = (await loadModel()).relationships.find((r) => r.id === id)!;
  const at = await pointOnLine(line, 0.3);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-relationship");
  await typeAndLeave(panel.getByTestId("input-relationship-label"), "holds");
  await pressOther(panel.getByTestId("seg-relationship-to"));
  await expect.poll(async () => (await loadModel()).relationships.find((r) => r.id === id)).toMatchObject({ label: "holds", version: before.version + 2 });
  expect(`${(await loadModel()).relationships.find((r) => r.id === id)!.to_min},${(await loadModel()).relationships.find((r) => r.id === id)!.to_max}`).not.toBe(`${before.to_min},${before.to_max}`);
  expect(await toasts(page)).toEqual([]);
});

test("S9-04: requirement: the name, then the owner", async ({ page }) => {
  await open(page);
  await openRequirement(page, "REQ-101");
  await typeAndLeave(page.getByTestId("input-req-name"), "Customers have one e-mail");
  await typeAndLeave(page.getByTestId("input-req-owner"), "Finance");
  await expect.poll(async () => requirementByKey("REQ-101")).toMatchObject({ name: "Customers have one e-mail", owner_name: "Finance" });
  expect(await toasts(page)).toEqual([]);
});

test("S9-04: source column: the note twice", async ({ page }) => {
  const id = await columnId("customers", "cust_no");
  await open(page, `${canvasUrl()}?row=${id}`);
  const note = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  await typeAndLeave(note, "From the CRM", "Tab");
  await typeAndLeave(note, "From the CRM, unique", "Tab");
  await expect.poll(async () => (await loadModel()).sourceColumns.find((c) => c.id === id)?.note_text).toBe("From the CRM, unique");
  // each save says so; no refusal
  expect(new Set(await toasts(page))).toEqual(new Set(["Note saved on cust_no"]));
});

test("S9-04: note (the canvas's own queue since slice 3b): the text, then the status", async ({ page }) => {
  const note = (await loadNotes()).find((n) => n.status === "open")!;
  await open(page, `${canvasUrl()}?note=${note.id}`);
  const panel = page.getByTestId("panel-note");
  await typeAndLeave(panel.getByTestId("input-note-panel-text"), "Ask Finance about the key", "Tab");
  await panel.getByTestId("seg-note-status").getByRole("button", { name: "Resolved" }).click();
  await expect.poll(async () => (await loadNotes()).find((n) => n.id === note.id)).toMatchObject({ body_text: "Ask Finance about the key", status: "resolved" });
  expect(await toasts(page)).not.toContainEqual(expect.stringContaining("Someone changed"));
});

test("S9-04: workspace settings: the name, then the client", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}?tab=settings`);
  const before = (await store().workspaces.get(RETAIL))!;
  await typeAndLeave(page.getByTestId("input-workspace-name"), "Retail Co – DWH 2026");
  await typeAndLeave(page.getByTestId("input-workspace-client"), "Retail Co AG");
  await expect
    .poll(async () => store().workspaces.get(RETAIL))
    .toMatchObject({ name: "Retail Co – DWH 2026", client_name: "Retail Co AG", version: before.version + 2 });
  expect(new Set(await toasts(page))).toEqual(new Set(["Settings saved."]));
});

test("S9-04: classification: the name twice", async ({ page }) => {
  await recordToasts(page);
  await openColumn(page, "customers", "cust_no");
  await openList(page);
  const name = page.getByTestId("dialog-classifications").locator('[data-testid="classification-row"][data-code="BK"]').getByTestId("input-classification-name");
  await typeAndLeave(name, "Klucz biznesowy");
  await typeAndLeave(name, "Klucz biznesowy (BK)");
  await expect.poll(async () => (await loadModel()).classifications.find((c) => c.code === "BK")?.name).toBe("Klucz biznesowy (BK)");
  expect(await toasts(page)).toEqual([]);
});
