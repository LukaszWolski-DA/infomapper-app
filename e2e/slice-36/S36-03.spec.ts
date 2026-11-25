// S36-03 (slice 36, criterion 3): "New document" offers the sign-off package after the ETL preset and before Blank,
// greyed out with "Create a baseline first." while the workspace has no baseline; made from the newest baseline, with
// the audience "Client", every mapping, no draft mark and its thirteen sections in order; everything can be changed.
import { test, expect } from "./fixtures";
import { chosenText, docsUrl, laidOut, modelState, signInAs, storedDocument, takeBaseline } from "./helpers";

const LABEL = "Sign-off package for the client";
const DESCRIPTION = "From a baseline: cover, introduction, overview, diagrams, dictionary, mappings, requirements and changes.";

test.describe("without a baseline", () => {
  test.use({ seed: "docs" });

  test("S36-03: the sign-off package is greyed out until a baseline exists", async ({ page }) => {
    await signInAs(page, "Łukasz");
    await page.goto(docsUrl());
    await page.getByTestId("button-new-document").click();
    const dialog = page.getByTestId("dialog-new-document");
    const presets = dialog.locator('[data-testid^="button-preset-"]');
    await expect(presets).toHaveCount(4);
    expect(await presets.evaluateAll((b) => b.map((x) => x.getAttribute("data-testid")))).toEqual(["button-preset-dictionary", "button-preset-s2t", "button-preset-signoff", "button-preset-blank"]);
    const signoff = dialog.getByTestId("button-preset-signoff");
    await expect(signoff).toBeDisabled();
    await expect(signoff).toContainText(LABEL);
    await expect(signoff).toContainText(DESCRIPTION);
    await expect(signoff.getByTestId("text-preset-off")).toHaveText("Create a baseline first.");
    await expect(signoff).toHaveAttribute("title", "Create a baseline first.");
  });
});

test.describe("with baselines", () => {
  test.use({ seed: "full" });

  test("S36-03: made from the newest baseline with its sections in order, and changed afterwards", async ({ page }) => {
    await takeBaseline("Stage 2 sign-off");
    await signInAs(page, "Anna Nowak");
    await page.goto(docsUrl());
    await page.getByTestId("button-new-document").click();
    const signoff = page.getByTestId("button-preset-signoff");
    await expect(signoff).toBeEnabled();
    await expect(signoff.getByTestId("text-preset-off")).toHaveCount(0);
    await signoff.click();
    await page.waitForURL(/\/w\/[^/]+\/d\/[^/?]+$/);
    await laidOut(page);

    const doc = (await storedDocument(LABEL))!;
    expect(doc).toMatchObject({ preset: "signoff", audience: "Client", source_kind: "baseline", shared: false });
    expect(doc.scope.mappings).toBe("all");
    expect(doc.style.watermark).toBe(false);
    await expect.poll(() => chosenText(modelState(page))).toMatch(/^Baseline “Stage 2 sign-off” \(\d{4}-\d\d-\d\d \d\d:\d\d\)$/);
    // the thirteen sections, in the PRD's order
    await expect(page.getByTestId("editor-section")).toHaveCount(13);
    expect(await page.getByTestId("editor-section").evaluateAll((r) => r.map((x) => x.getAttribute("data-section")))).toEqual([
      "text", "conv", "overview", "ready", "diagrams", "dict", "s2t", "reqs", "trace", "dq", "sources", "classreg", "changes",
    ]);
    expect(doc.sections[0]!.options.body).toBe("Scope of this stage: …\n\nAssumptions: …\n\nOpen points: …");
    expect((doc.sections[2]!.options.figures as { caption: string }[])[0]!.caption).toBe("Logical data model");
    expect(doc.sections.at(-1)!.options).toEqual({ against: null });
    // the changes section compares with the previous baseline: Stage 1
    await expect(page.getByTestId("document-host")).toContainText("Changes since “Stage 1 sign-off”");

    // changed afterwards like any document: the audience, a section removed
    await page.getByTestId("input-document-audience").fill("Retail Co");
    await page.getByTestId("input-document-audience").press("Tab");
    await expect.poll(async () => (await storedDocument(LABEL))!.audience).toBe("Retail Co");
    await page.locator('[data-testid="editor-section"][data-section="trace"]').getByTestId("button-section-remove").click();
    await expect(page.getByTestId("editor-section")).toHaveCount(12);
  });
});
