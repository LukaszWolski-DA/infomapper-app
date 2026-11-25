// S36-01 (slice 36, criterion 1): "New document from it" in a baseline's row makes a document from the sign-off preset
// with that baseline as its source and opens it in the editor. "Model state" offers the live model and each baseline,
// newest first; whoever may change the document switches it at any time. A document from a baseline shows the model as
// it was: a change of the live model afterwards changes nothing in it. Its footer names the baseline in the document's
// language; the draft mark is off, and switched on it reads "DRAFT · baseline {name}". The editor's note and hint.
import { test, expect } from "./fixtures";
import {
  exactPages,
  changeDb,
  chosenText,
  DEMO_BASELINE,
  expectVersion,
  laidOut,
  liveEntity,
  marginContent,
  minute,
  modelState,
  openBaselines,
  optionTexts,
  rowNamed,
  sectionText,
  signInAs,
  STAGE_1,
  storedDocument,
  takeBaseline,
} from "./helpers";

test.use({ seed: "full" });

const NOTE = "Tables and diagrams come from the baseline as it was taken. Label canvases are not drawn from a baseline.";
const HINT = "A baseline gives the same document every time; the live model always shows today.";

test("S36-01: New document from it, the model as it was taken, the footer, the switch at any time", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await rowNamed(page, STAGE_1).getByTestId("button-baseline-new-document").click();
  await page.waitForURL(/\/w\/[^/]+\/d\/[^/?]+$/);
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  // real pages after every change (S26-07's way): this document is long
  await exactPages(page);

  const name = `Documentation of “${STAGE_1}”`;
  await expect(page.getByTestId("input-document-name")).toHaveValue(name);
  const stored = (await storedDocument(name))!;
  expect(stored).toMatchObject({ preset: "signoff", source_kind: "baseline", baseline_id: DEMO_BASELINE.id, shared: false, audience: "Client", author_id: expect.any(String) });
  expect(stored.style.watermark).toBe(false);

  // Model state: the baseline chosen, the hint under it, the note above the preview
  const taken = minute(DEMO_BASELINE.at);
  await expect.poll(() => chosenText(modelState(page))).toBe(`Baseline “${STAGE_1}” (${taken})`);
  await expect(page.getByTestId("panel-document").getByText(HINT)).toBeVisible();
  await expect(page.getByTestId("note-baseline")).toHaveText(NOTE);

  // the footer's source, no draft mark
  await expect.poll(() => marginContent(page, 1, "bottom-left")).toBe(`"Retail Co – DWH · Baseline “${STAGE_1}” of ${taken}"`);
  expect(await marginContent(page, 1, "top-center")).not.toContain("DRAFT");

  // the model as it was: REQ-105 came later; a rename in the live model afterwards changes nothing here
  expect(await sectionText(page, "Requirements and coverage")).not.toContain("REQ-105");
  await changeDb((db) => {
    liveEntity(db, "Customer").name = "Client";
  });
  await page.reload();
  await exactPages(page);
  const dictionary = await sectionText(page, "Data dictionary");
  expect(dictionary).toContain("Customer");
  expect(dictionary).not.toContain("Client");
  await expect(page.getByTestId("button-print")).toBeEnabled();
  await expect(page.getByTestId("button-markdown")).toBeEnabled();

  // the list: the live model, then each baseline newest first
  const second = await takeBaseline("Stage 2 sign-off");
  await page.reload();
  await exactPages(page);
  const options = await optionTexts(modelState(page));
  expect(options[0]).toBe("Live model (changes as people work)");
  expect(options.slice(1).map((o) => o.replace(/ \(.*\)$/, ""))).toEqual(["Baseline “Stage 2 sign-off”", `Baseline “${STAGE_1}”`]);

  // switched to the live model: today's model, no note, the live footer
  await modelState(page).selectOption("live");
  await expectVersion(page, stored.version + 1);
  await expect.poll(() => sectionText(page, "Requirements and coverage"), { timeout: 30_000 }).toContain("REQ-105");
  await expect(page.getByTestId("note-baseline")).toHaveCount(0);
  await expect.poll(() => marginContent(page, 1, "bottom-left")).toMatch(/^"Retail Co – DWH · Live model on \d{4}-\d\d-\d\d"$/);
  expect(await sectionText(page, "Data dictionary")).toContain("Client");

  // to another baseline, then back to the first
  await modelState(page).selectOption(second);
  await expectVersion(page, stored.version + 2);
  await expect.poll(() => marginContent(page, 1, "bottom-left"), { timeout: 30_000 }).toContain("Baseline “Stage 2 sign-off” of");
  await expect.poll(() => sectionText(page, "Data dictionary")).toContain("Client");
  await modelState(page).selectOption(DEMO_BASELINE.id);
  await expectVersion(page, stored.version + 3);
  await expect.poll(() => sectionText(page, "Requirements and coverage"), { timeout: 30_000 }).not.toContain("REQ-105");
  expect((await storedDocument(name))!).toMatchObject({ source_kind: "baseline", baseline_id: DEMO_BASELINE.id });

  // the draft mark switched on names the baseline
  await page.getByTestId("check-style-watermark").check();
  await expect.poll(() => marginContent(page, 1, "top-center"), { timeout: 30_000 }).toBe(`"DRAFT · baseline ${STAGE_1}"`);
});

test("S36-01: a reader of a shared document from a baseline sees Model state read only", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await rowNamed(page, STAGE_1).getByTestId("button-baseline-new-document").click();
  await page.waitForURL(/\/w\/[^/]+\/d\/[^/?]+$/);
  await laidOut(page);
  await page.getByTestId("seg-shared").getByRole("button", { name: "Shared with the workspace" }).click();
  await expect.poll(async () => (await storedDocument(`Documentation of “${STAGE_1}”`))!.shared).toBe(true);
  const url = page.url();
  await signInAs(page, "Piotr Wiśniewski");
  await page.goto(url);
  await laidOut(page);
  await expect(modelState(page)).toBeDisabled();
  await expect.poll(() => chosenText(modelState(page))).toContain(`Baseline “${STAGE_1}”`);
});
