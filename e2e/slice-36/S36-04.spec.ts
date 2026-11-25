// S36-04 (slice 36, criterion 4): the Compare dialog's "Make a document" makes a private document named after the two
// states, its source the newer one (a baseline, or the live model for Now), its one section "Changes since" the older
// baseline, opened in the editor; the dialog's filters are not carried. Markdown of a document from a baseline names it
// in its front matter (`source: "baseline"`, `baseline`, `baseline_taken` with its offset from UTC).
import { test, expect } from "./fixtures";
import {
  chosenText,
  DEMO_BASELINE,
  laidOut,
  modelState,
  openBaselines,
  openCompare,
  openMarkdown,
  rowNamed,
  sectionText,
  signInAs,
  STAGE_1,
  storedDocument,
  takeBaseline,
} from "./helpers";

test.use({ seed: "full" });

/** The front matter's lines of a Markdown text. */
const frontMatter = (md: string): Record<string, string> =>
  Object.fromEntries(
    md
      .split("\n---")[0]!
      .split("\n")
      .slice(1)
      .map((l) => [l.slice(0, l.indexOf(":")), JSON.parse(l.slice(l.indexOf(":") + 1).trim()) as string]),
  );

test("S36-04: Make a document against Now: the live model with one changes section, ready to export", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  const dialog = await openCompare(page, STAGE_1);
  // a filter in the dialog is not carried into the document
  await dialog.getByTestId("input-compare-filter").fill("cust");
  const make = dialog.getByTestId("button-compare-make-document");
  await expect(make).toHaveAttribute("title", "A document from the newer state with one section: Changes since the older one");
  await make.click();
  await page.waitForURL(/\/w\/[^/]+\/d\/[^/?]+$/);
  await laidOut(page);

  const name = `Changes since “${STAGE_1}”`;
  await expect(page.getByTestId("input-document-name")).toHaveValue(name);
  const doc = (await storedDocument(name))!;
  expect(doc).toMatchObject({ preset: "blank", source_kind: "live", baseline_id: null, shared: false, audience: null });
  expect(doc.sections.map((s) => [s.type, s.options])).toEqual([["changes", { against: DEMO_BASELINE.id }]]);
  await expect.poll(() => chosenText(modelState(page))).toBe("Live model (changes as people work)");
  // every change since Stage 1, not only the filter's
  const text = await sectionText(page, name);
  expect(text).toContain("REQ-105");
  expect(text).toContain("Customer.segment_code");
  await expect(page.getByTestId("button-print")).toBeEnabled();
  const md = await openMarkdown(page);
  expect(frontMatter(md).source).toBe("live model");
  expect(md).toContain(`## ${name}`);
});

test("S36-04: Make a document between two baselines, from the newer one; Markdown names the baseline", async ({ page }) => {
  await takeBaseline("Stage 2 sign-off");
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  // opened from the newer row, compared with the older one: the older is still the start
  await rowNamed(page, "Stage 2 sign-off").getByTestId("button-baseline-compare").click();
  const dialog = page.getByTestId("dialog-compare-baseline");
  await dialog.getByTestId("select-compare-with").selectOption(DEMO_BASELINE.id);
  await expect(dialog.getByTestId("text-compare-line")).toBeVisible();
  await dialog.getByTestId("button-compare-make-document").click();
  await page.waitForURL(/\/w\/[^/]+\/d\/[^/?]+$/);
  await laidOut(page);

  const name = `Changes since “${STAGE_1}” to “Stage 2 sign-off”`;
  await expect(page.getByTestId("input-document-name")).toHaveValue(name);
  const doc = (await storedDocument(name))!;
  const stage2 = doc.baseline_id;
  expect(doc).toMatchObject({ preset: "blank", source_kind: "baseline" });
  expect(stage2).not.toBe(DEMO_BASELINE.id);
  expect(doc.sections[0]!.options).toEqual({ against: DEMO_BASELINE.id });
  expect(await sectionText(page, `Changes since “${STAGE_1}”`)).toContain("REQ-105");

  const fm = frontMatter(await openMarkdown(page));
  expect(fm.source).toBe("baseline");
  expect(fm.baseline).toBe("Stage 2 sign-off");
  expect(fm.baseline_taken).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d[+-]\d\d:\d\d$/);
  expect(fm.generated).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d[+-]\d\d:\d\d$/);
});

test("S36-04: a document from Stage 1 sign-off: Markdown's front matter with its time and offset", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await rowNamed(page, STAGE_1).getByTestId("button-baseline-new-document").click();
  await page.waitForURL(/\/w\/[^/]+\/d\/[^/?]+$/);
  await laidOut(page);
  const fm = frontMatter(await openMarkdown(page));
  expect(fm).toMatchObject({ source: "baseline", baseline: STAGE_1 });
  // 15 September 2026 10:12 in Warsaw (the e2e run's zone): summer time, +02:00
  expect(fm.baseline_taken).toBe("2026-09-15T10:12+02:00");
});
