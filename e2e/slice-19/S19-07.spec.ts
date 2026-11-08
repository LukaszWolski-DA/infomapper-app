// S19-07 (in part; CI, the element guard and the two full runs are in the acceptance doc): on the Sales star with slice 19's
// types (an aggregate, a junk dimension, a snapshot, an outrigger and its line), the canvas and the miniature do not
// commit while idle, and a pan adds no canvas commit (S2C-12's and S3B-15's guards). The chips are text and a class on
// existing elements: no element more on a card (AD-24).

import { expect, test } from "./fixtures";
import { SEED_USERS } from "../../src/data/local/seed";
import { updateCubeEntity } from "../../src/modules/infocube/domain/commands";
import { asCube, canvasCommits, card, cubeRow, emptySpot, openStar, roleOf, settledCommits, signInAs, typeEntity } from "./helpers";
import { miniatureCommits } from "../slice-03b/helpers";

test("S19-07: the star with its types does not commit while idle or panned; a chip adds no element", async ({ page }) => {
  // Fact Orders an accumulating, factless aggregate (test data): its chip is the longest one, "Fact · Accumulating ·
  // Factless · Aggregate"
  for (const change of [{ factType: "accumulating" as const }, { isFactless: true }]) {
    const row = (await cubeRow(typeEntity("orders")))!;
    await asCube(SEED_USERS.lukasz.id, (ctx, access) => updateCubeEntity(ctx, access, { cube: row }, { cubeEntityId: row.id, expectedVersion: row.version, ...change }));
  }
  await signInAs(page, "Łukasz");
  await openStar(page);
  await expect(roleOf(page, "Dim Category")).toHaveText("Dimension · Outrigger");

  const canvas = await settledCommits(page, canvasCommits);
  const mini = await settledCommits(page, miniatureCommits);
  expect(canvas).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  expect(await canvasCommits(page), "canvas commits while idle").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits while idle").toBe(mini);

  // a pan with the right button on an empty spot (slice 16: no toolbox after a right drag)
  const from = await emptySpot(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(from.x - 120, from.y - 60, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(1000);
  expect(await canvasCommits(page), "canvas commits after a pan").toBe(canvas);
  expect(await miniatureCommits(page), "miniature commits after a pan").toBe(mini);

  // a long chip on the default width is cut with "…", the concept text first, and the header line still fits (Q7, F11)
  const fact = page.locator(".react-flow__node").filter({ has: page.getByTestId("card-name").getByText("Fact Orders", { exact: true }) });
  const cut = await fact.locator(".c-l1").evaluate((l1) => {
    const role = l1.querySelector<HTMLElement>('[data-testid="card-role"]')!;
    const concept = role.nextElementSibling as HTMLElement;
    return { cut: role.scrollWidth > role.clientWidth, concept: concept.offsetWidth, fits: l1.scrollWidth <= l1.clientWidth };
  });
  expect(cut).toEqual({ cut: true, concept: 0, fits: true });
  await expect(roleOf(page, "Fact Orders")).toHaveAttribute("title", "Accumulating snapshot fact, factless, aggregate of Fact Sales (InfoCube)");

  // each chip is the one span a plain fact's is, its text and the cube's ::before only: no element more
  for (const name of ["Fact Orders", "Dim Category", "Dim Order Flags", "Dim Product", "Fact Sales"]) {
    await expect(roleOf(page, name).locator("*")).toHaveCount(0);
    await expect(card(page, name).getByTestId("card-role")).toHaveCount(1);
  }
});
