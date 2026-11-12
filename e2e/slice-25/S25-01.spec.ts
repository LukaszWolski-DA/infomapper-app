// S25-01 (slice 25, AD-35): InfoDocumenter's box in Settings, below InfoCube's. Without the licence it says so and the
// switch is disabled; with it an owner turns it on and the Documentation tab appears; a modeler cannot. Turning it off
// with documents is allowed: the tab goes, the documents stay and come back when it is on again.

import { expect, test } from "./fixtures";
import { docsUrl, expectToast, grantDocLicence, RETAIL, settingsUrl, signInAs, storedDocuments } from "./helpers";

test.describe("without the licence", () => {
  test.use({ seed: "plain" });

  test("S25-01: the box says the organization has no licence, the switch is disabled and there is no tab", async ({ page }) => {
    await signInAs(page, "Łukasz");
    await page.goto(settingsUrl());
    const box = page.getByTestId("box-infodoc");
    await expect(box).toBeVisible();
    // below InfoCube's box
    const [cube, doc] = await Promise.all([page.getByTestId("box-infocube").boundingBox(), box.boundingBox()]);
    expect(doc!.y).toBeGreaterThan(cube!.y);
    await expect(page.getByTestId("text-infodoc-licence")).toHaveText("InfoMate has no InfoDocumenter licence.");
    await expect(page.getByTestId("checkbox-infodoc")).toBeDisabled();
    await expect(page.getByTestId("checkbox-infodoc")).not.toBeChecked();
    await expect(page.getByTestId("tab-docs")).toHaveCount(0);
    // the tab's address opens Overview
    await page.goto(docsUrl());
    await expect(page.getByTestId("tab-overview")).toHaveAttribute("aria-selected", "true");
  });

  test("S25-01: with the licence an owner turns it on and the tab appears; a modeler cannot", async ({ page, browser }) => {
    await grantDocLicence();
    await signInAs(page, "Łukasz");
    await page.goto(settingsUrl());
    await expect(page.getByTestId("text-infodoc-licence")).toHaveText("Licensed for InfoMate.");
    await page.getByTestId("checkbox-infodoc").check();
    await expectToast(page, "InfoDocumenter is on: see the Documentation tab.");
    await expect(page.getByTestId("tab-docs")).toHaveText("Documentation (0)");

    const anna = await browser.newContext();
    const annaPage = await anna.newPage();
    await signInAs(annaPage, "Anna Nowak");
    await annaPage.goto(settingsUrl());
    await expect(annaPage.getByTestId("checkbox-infodoc")).toBeChecked();
    await expect(annaPage.getByTestId("checkbox-infodoc")).toBeDisabled();
    await expect(annaPage.getByTestId("tab-docs")).toBeVisible();
    await anna.close();
  });
});

test("S25-01: turning it off with documents keeps them; the tab goes and comes back when it is on again", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(settingsUrl());
  // Łukasz sees the shared dictionary and his private S2T, not Anna's private one
  await expect(page.getByTestId("tab-docs")).toHaveText("Documentation (2)");
  await page.getByTestId("checkbox-infodoc").uncheck();
  await expectToast(page, "InfoDocumenter is off. Its 3 documents are kept for when it is on again.");
  await expect(page.getByTestId("tab-docs")).toHaveCount(0);
  expect((await storedDocuments()).filter((d) => d.workspace_id === RETAIL && d.deleted_at === null)).toHaveLength(3);
  await page.goto(docsUrl());
  await expect(page.getByTestId("tab-overview")).toHaveAttribute("aria-selected", "true");

  await page.goto(settingsUrl());
  await page.getByTestId("checkbox-infodoc").check();
  await expectToast(page, "InfoDocumenter is on: see the Documentation tab.");
  await expect(page.getByTestId("tab-docs")).toHaveText("Documentation (2)");
  await page.getByTestId("tab-docs").click();
  await expect(page.getByTestId("row-document")).toHaveCount(2);
});
