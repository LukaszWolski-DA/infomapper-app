// S25-06 (slice 25, PRD section 2, Q-L4): with InfoCube on, the Dimensional model prints facts with grain, dimensions
// with role and key, the unknown member, measures and feeds, in InfoCube's words in the document's language; with InfoCube
// off the section is skipped and the page says so; the dimensional level out of scope removes the section's content. The
// demo with the star: Łukasz's S2T ends with the Dimensional model (made while InfoCube was on).

import { writeInfoCubeOff } from "../slice-22/helpers";
import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, formUrl, keepOnly, laidOut, RETAIL, sectionText, setWorkspace, signInAs, storedDocument, unnumbered, viewUrl } from "./helpers";

test.use({ seed: "full" });

const S2T = DEMO_DOCUMENT_NAMES.s2t;

async function openView(page: Page) {
  await keepOnly(S2T, ["s2t", "cube.dim"]);
  await unnumbered(S2T);
  await page.goto(viewUrl((await storedDocument(S2T))!.id));
  await laidOut(page);
}

test("S25-06: facts with grain, dimensions with role, key and no-match value, measures, unknown member and feeds", async ({ page }) => {
  // slice 26 (D2): the preset's Dimensional model in its place; this spec reads the S2T and it alone
  expect((await storedDocument(S2T))!.sections.map((s) => s.type)).toEqual(["conv", "s2t", "sources", "cube.dim", "dq"]);
  await signInAs(page, "Łukasz");
  await openView(page);
  await expect(page.getByTestId("document-host").locator(".dtoc li")).toHaveText([/^Source-to-target mapping/, /^Dimensional model/]);
  const text = await sectionText(page, "Dimensional model");
  for (const part of ["Facts", "Fact Sales", "Transaction fact", "Fact type", "Grain", "One order line", "Order date", "date_key", "No match →", "Measures", "Additivity", "Additive", "Fed from", "Sales Order.order_date"]) {
    expect(text, part).toContain(part);
  }
  for (const part of ["Dimensions", "Dim Product", "Dimension, snapshot (Month-end)", "Snapshot · Month-end", "Unknown member", "Junk dimension", "Transaction fact, aggregate of Fact Sales"]) {
    expect(text, part).toContain(part);
  }
});

test("S25-06: InfoCube's words in the document's language (Polish)", async ({ page }) => {
  await setWorkspace(RETAIL, { doc_language: "pl" });
  await signInAs(page, "Łukasz");
  await openView(page);
  const text = await sectionText(page, "Model wymiarowy");
  for (const part of ["Fakty", "Wymiary", "Typ faktu", "Ziarno", "Transakcyjny", "Miary", "Addytywność", "Addytywna", "Zasilany z", "Migawka · Month-end", "Wymiar typu junk", "Fakt transakcyjny, agregat faktu Fact Sales"]) {
    expect(text, part).toContain(part);
  }
  // names and grains as the model has them
  expect(text).toContain("Fact Sales");
  expect(text).toContain("One order line");
});

test("S25-06: with InfoCube off the section is skipped and the page says so", async ({ page }) => {
  await writeInfoCubeOff();
  await signInAs(page, "Łukasz");
  await openView(page);
  const host = page.getByTestId("document-host");
  await expect(host.locator(".dtoc li")).toHaveText([/^Source-to-target mapping/]);
  await expect(host.getByTestId("document-skipped")).toHaveText("Skipped while InfoCube is off: Dimensional model.");
  // the editor keeps it, marked off (slice 26: its row on the left)
  await page.goto(formUrl((await storedDocument(S2T))!.id));
  const section = page.locator('[data-testid="editor-section"][data-section="cube.dim"]');
  await expect(section.getByTestId("tag-section-off")).toHaveAttribute("title", "InfoCube is off in this workspace");
});

test("S25-06: the dimensional level out of scope removes the section's content", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(formUrl((await storedDocument(S2T))!.id));
  await page.getByTestId("check-level-dimensional").uncheck();
  await expect.poll(async () => (await storedDocument(S2T))!.scope.dimensional).toBe(false);
  await openView(page);
  const text = await sectionText(page, "Dimensional model");
  expect(text).toContain("There are no facts or dimensions in this model state.");
  expect(text).not.toContain("Fact Sales");
});
