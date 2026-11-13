// S26-07 (slice 26, D1, PRD item 8): the Data dictionary's layouts (the definition under the row, as a column, one block
// per attribute) and long definitions at the end; with InfoCube on and the dimensional level in scope the demo's facts
// and dimensions with their role and feeds; with InfoCube off or the level out of scope, none. Changed in the editor.

import { writeInfoCubeOff } from "../slice-22/helpers";
import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, formUrl, laidOut, openEditor, RETAIL, rowOfType, sectionText, setSections, signInAs, storedDocument, viewUrl } from "./helpers";

test.use({ seed: "full" });

const SHARED = DEMO_DOCUMENT_NAMES.shared;
const LONG = `Where we write to the customer. ${"It is checked when it is entered and kept up to date by the service team. ".repeat(6)}`.trim();

test("S26-07: the dictionary's three layouts and long definitions, chosen in the editor", async ({ page }) => {
  await changeDb((db) => {
    const customer = db.entity.find((e) => e.workspace_id === RETAIL && e.name === "Customer")!;
    db.attribute.find((a) => a.entity_id === customer.id && a.name === "email")!.definition_text = LONG;
  });
  await setSections(SHARED, [{ type: "dict", options: { columns: ["attribute", "type", "definition", "mappedFrom"] } }]);
  await signInAs(page, "Łukasz");
  await openEditor(page, formUrl((await storedDocument(SHARED))!.id));
  // real pages after every change: a slow layout on the dev server would otherwise show the quick sheet (Auto)
  await page.getByTestId("select-preview-mode").selectOption("exact");
  const host = page.getByTestId("document-host");
  // under each row
  await expect(host.locator("tr.ddr td").filter({ hasText: "Where we write to the customer." })).toHaveCount(1);
  await rowOfType(page, "dict").click();

  // as a column, with its width
  await page.getByTestId("seg-dict-layout").getByRole("button", { name: "Definition as a column" }).click();
  await expect(page.getByTestId("select-dict-definitionWidth")).toBeVisible();
  await page.getByTestId("select-dict-definitionWidth").selectOption("50");
  await expect.poll(async () => (await storedDocument(SHARED))!.sections[0]!.options.definitionWidth).toBe(50);
  await expect(host.locator("table.dt.fixed col").nth(2)).toHaveAttribute("style", /width: 50%/);
  await expect(host.locator("tr.ddr")).toHaveCount(0);

  // one block per attribute
  await page.getByTestId("seg-dict-layout").getByRole("button", { name: "One block per attribute" }).click();
  await expect(host.locator(".dattrc").first()).toBeVisible();
  await expect(host.locator(".dattrc").filter({ hasText: "email" }).locator(".dac-d")).toContainText("Where we write to the customer.");

  // long definitions to the end of the section
  await page.getByTestId("seg-dict-layout").getByRole("button", { name: "Definition under each row" }).click();
  await page.getByTestId("select-dict-longDefinitions").selectOption("300");
  await expect(host.locator(".dref").filter({ hasText: "→ note 1" })).toHaveCount(1);
  await expect(host.locator("h3.dh3").filter({ hasText: "Definitions in full" })).toHaveCount(1);
  await expect(host.locator("ol.dnotes li").first()).toContainText("Customer.email");
});

test("S26-07: the dimensional entities with their role and feeds while InfoCube is on and their level is in scope", async ({ page }) => {
  await setSections(SHARED, [{ type: "dict", options: { entity: ["stereotype"], columns: ["attribute", "mappedFrom"] } }]);
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(SHARED))!;
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  let text = await sectionText(page, "Data dictionary");
  for (const part of ["Fact Sales", "Transaction fact", "Dim Product", "Dimension, snapshot (Month-end)", "Order Line.quantity"]) expect(text, part).toContain(part);

  // the dimensional level out of scope: none
  await changeDb((db) => {
    (db as unknown as { document_definition: { name: string; scope: { dimensional: boolean } }[] }).document_definition.find((d) => d.name === SHARED)!.scope.dimensional = false;
  });
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  text = await sectionText(page, "Data dictionary");
  expect(text).toContain("Customer");
  expect(text).not.toContain("Fact Sales");

  // InfoCube off, the level in scope again: none
  await changeDb((db) => {
    (db as unknown as { document_definition: { name: string; scope: { dimensional: boolean } }[] }).document_definition.find((d) => d.name === SHARED)!.scope.dimensional = true;
  });
  await writeInfoCubeOff();
  await page.goto(viewUrl(doc.id));
  await laidOut(page);
  text = await sectionText(page, "Data dictionary");
  expect(text).not.toContain("Fact Sales");
  expect(text).not.toContain("Dim Product");
});
