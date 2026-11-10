// S21-05 (slice 21, item 5, D-41, D-59, D-76): the workspace settings' "Concept colours". A modeler (Anna) changes
// Customer's colour: the toast, one undo step, undone from the workspace home and, after another change, from a canvas,
// where the card, the concept frame and the left panel's dot follow; the same colour again writes nothing; violet is
// not offered (the eight palette colours only). A reviewer and a reader see the swatches disabled; an archived workspace
// is read only.

import { CONCEPT_PALETTE } from "../../src/domain/model/concept-colors";
import { expect, test, type Page } from "./fixtures";
import {
  archive,
  canvasUrl,
  card,
  colourLine,
  expectToast,
  frameEl,
  hydrated,
  item,
  liveConceptNamed,
  makeFrame,
  openCanvas,
  settingsUrl,
  signInAs,
  swatch,
  undoButton,
  WHOLE_CO,
} from "./helpers";

const NEW = "#1D9E75", OLD = "#2F7DD1";
const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const customer = () => liveConceptNamed("Customer");

async function openSettings(page: Page) {
  await page.goto(settingsUrl().replace("tab=settings", "tab=conventions")); // slice 23: the colours moved to the tab
  await hydrated(page);
  await expect(page.getByTestId("box-concept-colours")).toBeVisible();
}

/** The colours drawn for Customer on a canvas: its card's `--cc`, its concept frame's `--fc`, the Model tab's dot. */
async function drawn(page: Page) {
  const cardColour = await card(page, "Customer").evaluate((el) => (el.querySelector<HTMLElement>('[style*="--cc"]') ?? (el as HTMLElement)).style.getPropertyValue("--cc"));
  const frameColour = await frameEl(page, "Customer here").evaluate((el) => ((el as HTMLElement).style.getPropertyValue("--fc") || el.querySelector<HTMLElement>('[style*="--fc"]')?.style.getPropertyValue("--fc")) ?? "");
  const dot = await page.getByTestId("tree-concept-head").filter({ hasText: "Customer" }).first().locator("i").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  return { card: cardColour.trim().toUpperCase(), frame: frameColour.trim().toUpperCase(), dot };
}

test("S21-05: a modeler changes a concept's colour: the toast, one undo step from the home and from a canvas; the canvas follows", async ({ page }) => {
  const order = await item("Order Line");
  await makeFrame({ x: order.x + 600, y: order.y, width: 400, height: 260 }, { name: "Customer here", concept: "Customer" });
  await signInAs(page, "Anna Nowak");
  await openSettings(page);

  // the palette only: eight swatches, violet not offered; Customer's own pressed
  const line = colourLine(page, "Customer");
  await expect(line.locator("button")).toHaveCount(8);
  expect(await line.locator("button").evaluateAll((els) => els.map((e) => e.getAttribute("data-colour")))).toEqual([...CONCEPT_PALETTE]);
  await expect(page.getByTestId("box-concept-colours")).toContainText("Violet is reserved for requirements, so it is not offered here;");
  await expect(swatch(page, "Customer", OLD)).toHaveAttribute("aria-pressed", "true");
  await expect(line.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await expect(swatch(page, "Customer", OLD)).toBeEnabled();

  // a change: the toast, the stored colour, the swatch pressed
  const v0 = (await customer())!.version;
  await swatch(page, "Customer", NEW).click();
  await expectToast(page, "Changed the colour of Customer.");
  await expect.poll(async () => (await customer())!.color).toBe(NEW);
  await expect(swatch(page, "Customer", NEW)).toHaveAttribute("aria-pressed", "true");
  // the same colour again writes nothing
  const v1 = (await customer())!.version;
  expect(v1).toBe(v0 + 1);
  await swatch(page, "Customer", NEW).click();
  expect((await customer())!.version).toBe(v1);

  // one undo step, from the workspace home's Undo
  await undoButton(page).click();
  await expectToast(page, "Undone: Change colour of Customer");
  await expect.poll(async () => (await customer())!.color).toBe(OLD);
  await expect(swatch(page, "Customer", OLD)).toHaveAttribute("aria-pressed", "true");

  // again; the canvas follows, and its Undo takes the step back
  await swatch(page, "Customer", NEW).click();
  await expect.poll(async () => (await customer())!.color).toBe(NEW);
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await expect.poll(() => drawn(page)).toEqual({ card: NEW, frame: NEW, dot: rgb(NEW) });
  await undoButton(page).click();
  await expect.poll(async () => (await customer())!.color).toBe(OLD);
  await expect.poll(() => drawn(page)).toEqual({ card: OLD, frame: OLD, dot: rgb(OLD) });
});

test("S21-05: a reviewer and a reader see the swatches disabled; an archived workspace is read only", async ({ page, browser }) => {
  for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const context = await browser.newContext();
    const p = await context.newPage();
    await signInAs(p, who);
    await openSettings(p);
    await expect(colourLine(p, "Customer").locator("button:enabled")).toHaveCount(0);
    await expect(swatch(p, "Customer", OLD)).toHaveAttribute("aria-pressed", "true");
    await context.close();
  }
  await archive();
  await signInAs(page, "Łukasz");
  await openSettings(page);
  await expect(colourLine(page, "Customer").locator("button:enabled")).toHaveCount(0);
});
