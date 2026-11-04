import { createCubeEntity } from "../../src/modules/infocube/domain/commands";
import { INFOCUBE_OFF_MESSAGE, turnOffRefusedMessage } from "../../src/domain/model/levels";
import { expect, test } from "./fixtures";
import {
  card,
  cubeEntities,
  cubeStore,
  deleteFromModel,
  emptySpot,
  hydrated,
  infocubeCheck,
  liveEntityNamed,
  openCanvas,
  recordToasts,
  refusalAs,
  SEED_IDS,
  settingsUrl,
  signInAs,
  STAR_VIEW,
  starUrl,
  switchRefusal,
  toasts,
  toolboxAt,
  workspaceRow,
} from "./helpers";

// S15-04 (C-7 as changed on 4 November 2026; replaces the spec's IC-14): InfoCube is turned off only while the
// workspace has no facts or dimensions. While it is off nothing creates or brings one back: no Cube tab, no New fact or
// New dimension, a direct create refused, and the undo of the deletes refused with the step kept in the history.
// Deleting a logical entity works.

const STAR_NAMES = ["Fact Sales", "Fact Orders", "Dim Customer", "Dim Product", "Dim Date"];

test("S15-04: turning off is refused with 5 facts and dimensions; after deleting them it is off; then no Cube tab, creates and undo refused, a logical delete works", async ({ page }) => {
  test.setTimeout(120_000);
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(settingsUrl());
  await hydrated(page);
  await expect(infocubeCheck(page)).toBeChecked();
  await infocubeCheck(page).uncheck();
  const refused = turnOffRefusedMessage(5);
  expect(refused).toBe("InfoCube can be turned off only when this workspace has no facts or dimensions. It has 5: delete them first.");
  // shown in place, under the check box, and the check box shows the stored value again
  await expect(page.getByTestId("text-infocube-refusal")).toHaveText(refused);
  await expect(infocubeCheck(page)).toBeChecked();
  expect(await switchRefusal(SEED_IDS.userLukasz, false)).toBe(refused);
  expect((await workspaceRow()).infocube).toBe(true);

  // delete every fact and dimension: five undo steps
  await openCanvas(page, starUrl(), STAR_VIEW);
  for (const name of STAR_NAMES) await deleteFromModel(page, name);
  await expect.poll(async () => (await cubeEntities()).length).toBe(0);

  await page.goto(settingsUrl());
  await hydrated(page);
  await infocubeCheck(page).uncheck();
  await expect.poll(() => toasts(page)).toContain("InfoCube is off.");
  await expect.poll(async () => (await workspaceRow()).infocube).toBe(false);

  // off: no Cube tab, no New fact or New dimension, a direct create refused
  await openCanvas(page, starUrl(), STAR_VIEW);
  await expect(page.getByTestId("tab-cube")).toHaveCount(0);
  const items = await toolboxAt(page, await emptySpot(page));
  expect(items.filter((i) => /New (fact|dimension) here/.test(i))).toEqual([]);
  await page.keyboard.press("Escape");
  const s = cubeStore();
  const { concepts, entities } = await s.model.load(SEED_IDS.wsRetailDwh);
  expect(await refusalAs(SEED_IDS.userLukasz, (ctx, access) => createCubeEntity(ctx, access, { concept: concepts[0]!, entities, canvas: null }, "fact", { conceptId: concepts[0]!.id }))).toBe(INFOCUBE_OFF_MESSAGE);

  // the undo of the last delete (Dim Date) is refused with the C-7 message, and the step stays
  await page.getByTestId("button-undo").click();
  await expect.poll(() => toasts(page)).toContain(INFOCUBE_OFF_MESSAGE);
  expect(await liveEntityNamed("Dim Date")).toBeUndefined();
  await expect(page.getByTestId("button-undo")).toBeEnabled();

  // a logical entity is deleted as before
  await deleteFromModel(page, "Country");
  await expect.poll(async () => await liveEntityNamed("Country")).toBeUndefined();
  await expect(card(page, "Country")).toHaveCount(0);

  // the refused step stayed: with InfoCube on again, undo brings Country back, then Dim Date with its role
  await page.goto(settingsUrl());
  await hydrated(page);
  await infocubeCheck(page).check();
  await expect.poll(async () => (await workspaceRow()).infocube).toBe(true);
  await openCanvas(page, starUrl(), STAR_VIEW);
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await liveEntityNamed("Country"))?.name).toBe("Country");
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await liveEntityNamed("Dim Date"))?.name).toBe("Dim Date");
  await expect.poll(async () => (await cubeEntities()).map((c) => c.role)).toEqual(["dimension"]);
});
