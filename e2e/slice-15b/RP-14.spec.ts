import { expect, test } from "./fixtures";
import { canvasUrl, hydrated, model, openCanvas, pillOf, redoButton, signInAs, undoButton } from "./helpers";
import { SEED_IDS } from "../slice-01a/helpers";
import { clickLine, LOOP_VIEW, selfRelationship } from "../slice-10a/helpers";

// RP-14 (RP-A, R2): roles are InfoMapper's, on any relationship. A logical relationship with the role "billing": the
// pill shows it, the sentences say "as billing", there is no InfoCube section, a swap moves the role with its end, and
// each is one undo step. On a relationship to itself the role fields use the cardinality fields' words.

const VIEW = LOOP_VIEW;

test("RP-14: Customer – Sales Order with the role billing: the pill, the sentences, no InfoCube section; swap moves it; undo", async ({ page }) => {
  const m = await model();
  const id = (name: string) => m.entities.find((e) => e.name === name && e.deleted_at === null)!.id;
  const places = m.relationships.find((r) => r.from_entity_id === id("Customer") && r.to_entity_id === id("Sales Order"))!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(SEED_IDS.canvasCustomerOrders), VIEW);
  await hydrated(page);
  await clickLine(page, places.id);
  const panel = page.getByTestId("panel-relationship");
  await expect(panel.locator("label[for=f-rfr]")).toHaveText("Role of Customer");
  await expect(panel.locator("label[for=f-rtr]")).toHaveText("Role of Sales Order");
  await expect(page.getByTestId("input-relationship-from-role")).toHaveAttribute("placeholder", "e.g. Ship date");
  await page.getByTestId("input-relationship-from-role").fill("  billing ");
  await page.getByTestId("input-relationship-from-role").press("Tab");
  const stored = async () => (await model()).relationships.find((r) => r.id === places.id)!;
  await expect.poll(async () => (await stored()).from_role).toBe("billing");
  await expect(pillOf(page, places.id).locator("text")).toHaveText("billing");
  await expect(page.getByTestId("relationship-sentences")).toContainText("belongs to exactly one Customer as billing.");
  await expect(page.getByTestId("section-cube-key")).toHaveCount(0);

  await page.getByTestId("button-swap-relationship").click();
  await expect.poll(async () => [(await stored()).from_entity_id, (await stored()).from_role, (await stored()).to_role]).toEqual([id("Sales Order"), null, "billing"]);
  await expect(page.getByTestId("relationship-sentences")).toContainText(/Each Sales Order .* Customer as billing\./);
  await expect(pillOf(page, places.id).locator("text")).toHaveText("billing");

  await undoButton(page).click();
  await expect.poll(async () => [(await stored()).from_entity_id, (await stored()).from_role]).toEqual([id("Customer"), "billing"]);
  await undoButton(page).click();
  await expect.poll(async () => (await stored()).from_role).toBeNull();
  await expect(pillOf(page, places.id).locator("text")).toHaveText(places.label ?? "");
  await redoButton(page).click();
  await expect.poll(async () => (await stored()).from_role).toBe("billing");
});

test("RP-14 (R2): on a relationship to itself the role fields say Role at the right end and Role at the top end", async ({ page }) => {
  const loop = await selfRelationship("Customer", { label: "refers" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(SEED_IDS.canvasCustomerOrders), VIEW);
  await clickLine(page, loop.id);
  const panel = page.getByTestId("panel-relationship");
  await expect(panel.locator("label[for=f-rfr]")).toHaveText("Role at the right end");
  await expect(panel.locator("label[for=f-rtr]")).toHaveText("Role at the top end");
  await expect(panel.getByText("At the right end", { exact: true })).toBeVisible();
  await expect(panel.getByText("At the top end", { exact: true })).toBeVisible();
});
