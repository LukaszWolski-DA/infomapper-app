// S23-06 (slice 23, items 12, 13, F11, F12): the colours box in the tab changes a concept's colour as Settings did (one
// undo step); Settings has no colours box, and its "Model conventions" box (a deliberate difference from the prototype:
// the sentence and the button only) opens the tab; the naming conventions are saved, cleared, outside undo, and read only
// for a reader.
// Slice 24 (item 11): the sentence names the entity stereotypes.

import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { expectToast, hydrated, openConventions, RETAIL, settingsTabUrl, typeAndLeave, undoButton } from "./helpers";

const NEW = "#1D9E75", OLD = "#2F7DD1";
const swatch = (page: import("@playwright/test").Page, concept: string, colour: string) =>
  page.getByTestId("box-concept-colours").locator(`[data-testid="concept-colour"][data-concept="${concept}"] button[data-colour="${colour}"]`);
const customerColour = async () => (await readDb(E2E_DB)).concept.find((c) => c.workspace_id === RETAIL && c.name === "Customer" && c.deleted_at === null)!.color;
const naming = async () => (await readDb(E2E_DB)).workspace.find((w) => w.id === RETAIL)!.naming_conventions;

test("S23-06: the colours in the tab, one undo step; Settings points to the tab", async ({ page }) => {
  await openConventions(page, "Anna Nowak");
  await expect(page.getByTestId("box-concept-colours")).toContainText(
    "Each concept's colour on canvases and in documents. Violet is reserved for requirements, so it is not offered here; a new concept takes the first colour no concept uses.",
  );
  await expect(swatch(page, "Customer", OLD)).toHaveAttribute("aria-pressed", "true");
  await swatch(page, "Customer", NEW).click();
  await expectToast(page, "Changed the colour of Customer.");
  await expect.poll(customerColour).toBe(NEW);
  await undoButton(page).click();
  await expectToast(page, "Undone: Change colour of Customer");
  await expect.poll(customerColour).toBe(OLD);
  await expect(swatch(page, "Customer", OLD)).toHaveAttribute("aria-pressed", "true");

  await page.goto(settingsTabUrl());
  await hydrated(page);
  await expect(page.getByTestId("form-workspace-settings")).toBeVisible();
  await expect(page.getByTestId("box-concept-colours")).toHaveCount(0);
  const box = page.getByTestId("box-model-conventions");
  await expect(box.locator("h4")).toHaveText("Model conventions");
  await expect(box.locator("p")).toHaveText("Classifications, entity stereotypes, concept colours and naming conventions are edited in Metadata conventions.");
  await box.getByTestId("button-open-conventions").click();
  await expect(page).toHaveURL(/\?tab=conventions$/);
  await expect(page.getByTestId("page-conventions")).toBeVisible();
});

test("S23-06: the naming conventions saved, cleared, outside undo; read only for a reader", async ({ page, browser }) => {
  await openConventions(page, "Anna Nowak");
  const field = page.getByTestId("input-naming-conventions");
  await expect(page.getByTestId("box-naming-conventions")).toContainText(
    "Your rules for names of entities, attributes, keys and codes, as plain text. Documents print them in their conventions section; nothing checks names against them yet.",
  );
  await expect(field).toHaveAttribute("placeholder", "- Entities: singular, Title Case (Sales Order)\n- Attributes: snake_case (order_date)\n- Keys: …_id; surrogate keys: …_key");
  const version = (await readDb(E2E_DB)).workspace.find((w) => w.id === RETAIL)!.version;
  await typeAndLeave(field, "  - Entities: singular\n- Keys: …_id  ");
  await expectToast(page, "Saved the naming conventions.");
  await expect.poll(naming).toBe("- Entities: singular\n- Keys: …_id");
  expect((await readDb(E2E_DB)).workspace.find((w) => w.id === RETAIL)!.version).toBe(version + 1);
  // outside undo: the home's Undo has nothing to undo from it
  await expect(undoButton(page)).toBeDisabled();
  // kept after a reload
  await page.reload();
  await hydrated(page);
  await expect(field).toHaveValue("- Entities: singular\n- Keys: …_id");

  // a reader sees it read only
  const context = await browser.newContext();
  const reader = await context.newPage();
  await openConventions(reader, "Kasia Zielińska");
  await expect(reader.getByTestId("input-naming-conventions")).toHaveAttribute("readonly", "");
  await expect(reader.getByTestId("input-naming-conventions")).toHaveValue("- Entities: singular\n- Keys: …_id");
  await context.close();

  await typeAndLeave(field, "   ");
  await expectToast(page, "Cleared the naming conventions.");
  await expect.poll(naming).toBeNull();
});
