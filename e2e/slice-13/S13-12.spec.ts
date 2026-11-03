import { updateAttribute } from "../../src/domain/commands/attribute";
import { expect, test } from "./fixtures";
import { asUser, attributeOf, canvasCommits, canvasUrl, conflictLine, FULL, hydrated, loadModel, openCanvas, rowNamed, SEED_IDS, settledCommits, signInAs, useThis } from "./helpers";

// S13-12 (PRD section 6, F19): typing in a panel field and pressing "Use this" add no canvas commit
// (`window.__imCanvasCommits`, development); the conflict's fresh page, with its line, adds as many as the fresh page
// of an own save of the same field (both rename the card's row). The counts are printed for the step's record.

async function renameAsAnna(from: string, name: string) {
  const model = await loadModel();
  const a = await attributeOf("Customer", from);
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateAttribute(ctx, access, { attribute: a, attributes: model.attributes, entities: model.entities }, { attributeId: a.id, expectedVersion: a.version, name }));
}

test("S13-12: typing and Use this add no canvas commit; a conflict's fresh page and line add as many as an own save's", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await rowNamed(page, "Customer", "customer_id").click();
  const panel = page.getByTestId("panel-attribute");
  const name = panel.getByTestId("input-attribute-name");
  await expect(name).toHaveValue("customer_id");

  const start = await settledCommits(page, canvasCommits);
  expect(start).toBeGreaterThan(0); // the development counter is there
  await name.click();
  await name.press("End");
  await page.keyboard.type("_twenty_characters_x"); // 20 characters
  const typed = await settledCommits(page, canvasCommits);

  // an own save of the name: its fresh page renames the card's row
  await name.press("Enter");
  await expect.poll(async () => (await loadModel()).attributes.some((x) => x.name === "customer_id_twenty_characters_x")).toBe(true);
  const saved = await settledCommits(page, canvasCommits);

  // a conflict on the same field: the refusal's fresh page renames the row to Anna's name, and the line shows
  await renameAsAnna("customer_id_twenty_characters_x", "customer_no");
  await name.fill("customer_key");
  await name.press("Enter");
  await expect(conflictLine(panel)).toBeVisible();
  const conflicted = await settledCommits(page, canvasCommits);

  await useThis(panel).click();
  await expect(name).toHaveValue("customer_no");
  const used = await settledCommits(page, canvasCommits);

  console.log(`S13-12 canvas commits: typing ${typed - start}, own save ${saved - typed}, conflict ${conflicted - saved}, Use this ${used - conflicted}`);
  expect(typed - start).toBe(0);
  expect(conflicted - saved).toBe(saved - typed);
  expect(used - conflicted).toBe(0);
});
