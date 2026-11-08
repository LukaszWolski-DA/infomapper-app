// S19-04 (items 4, 5): Dim Order Flags is a junk dimension (chip, panel); Dim Category is an outrigger of Dim Product
// (chip, both panels, "Used by"); deleting the relationship "groups" removes the outrigger everywhere; undo brings it back.

import { expect, test } from "./fixtures";
import { clickLine, GROUPS, kindSeg, openEntity, openStar, roleOf, segment, signInAs, undoButton } from "./helpers";

test("S19-04: a junk dimension; an outrigger derived from “groups”, gone with it and back with its undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);

  await expect(roleOf(page, "Dim Order Flags")).toHaveText("Dimension · Junk");
  await expect(roleOf(page, "Dim Order Flags")).toHaveAttribute("title", "Junk dimension (InfoCube)");
  await openEntity(page, "Dim Order Flags");
  await expect(segment(kindSeg(page), "Junk")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("text-cube-dim-kind")).toHaveText("Low-cardinality flags and indicators gathered in one dimension instead of many small ones on the fact.");

  await expect(roleOf(page, "Dim Category")).toHaveText("Dimension · Outrigger");
  await expect(roleOf(page, "Dim Category")).toHaveAttribute("title", "Dimension, outrigger of Dim Product (InfoCube)");
  await openEntity(page, "Dim Category");
  await expect(page.getByTestId("item-cube-outrigger-of")).toHaveText([/^Dim Product\s*from the relationship$/]);
  await expect(page.getByTestId("section-cube-dimension")).toContainText("A dimension referenced by another dimension, not by a fact. It follows from the relationship.");
  await expect(page.getByTestId("section-cube-dimension")).toContainText("No fact uses it directly; it is reached through Dim Product.");
  await openEntity(page, "Dim Product");
  await expect(page.getByTestId("item-cube-outrigger")).toHaveText([/^Dim Category\s*outrigger$/]);
  await expect(roleOf(page, "Dim Product")).toHaveText("Dimension · Snapshot");

  await clickLine(page, GROUPS);
  await page.getByTestId("panel-relationship").getByTestId("button-delete-relationship").click();
  await expect(roleOf(page, "Dim Category")).toHaveText("Dimension");
  await openEntity(page, "Dim Category");
  await expect(page.getByTestId("item-cube-outrigger-of")).toHaveCount(0);
  await expect(page.getByTestId("section-cube-dimension")).toContainText("No fact uses it yet.");
  await openEntity(page, "Dim Product");
  await expect(page.getByTestId("item-cube-outrigger")).toHaveCount(0);

  await undoButton(page).click();
  await expect(roleOf(page, "Dim Category")).toHaveText("Dimension · Outrigger");
  await expect(page.getByTestId("item-cube-outrigger")).toHaveText([/^Dim Category\s*outrigger$/]);
});
