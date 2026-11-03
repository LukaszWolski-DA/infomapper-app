import { addPerson, signInWithPassword, signOutViaMenu } from "../slice-08/helpers";
import { FREE_FRAME_COLORS } from "../../src/domain/model/frames";
import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeFrameAsAnna,
  conflictLine,
  expectToast,
  frameEl,
  FRAMED,
  frameRow,
  hydrated,
  holdUntil,
  makeFrame,
  notSaved,
  openCanvas,
  openFrame,
  otherValue,
  recordToasts,
  SEED_IDS,
  signInAs,
  STALE,
  toasts,
} from "./helpers";

// S14A-01 (items 1–3a, F1–F3, F7): a frame's name saves through the canvas's queue, whose answer now reaches the field.
// A stale refusal shows slice 13's conflict line once the fresh page is in (the canvas draws Anna's name too); a name
// save waiting behind a refused frame write is cut: "Not saved", one toast, and leaving the field saves it; a locked
// organization's refusal brings no fresh page and keeps the name editable with "Not saved". An invalid frame name
// cannot be typed in the panel (an empty one goes back, D-59; no length limit): the queue's "invalid cuts nothing" is a
// unit test (`src/canvas/save-cuts.test.ts`).

const AREA = { x: 472, y: 0, width: 304, height: 856 };

test("S14A-01: a frame's name refused as stale: the conflict line with Anna's name, the canvas shows it, nothing written", async ({ page }) => {
  const area = await makeFrame(AREA, { name: "Area" });
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hydrated(page);
  const panel = await openFrame(page, "Area");
  const name = panel.getByTestId("input-frame-name");

  await changeFrameAsAnna(area, { name: "Zone" });
  await name.fill("Bereich");
  await name.press("Enter");
  await expectToast(page, STALE);
  await expect(conflictLine(panel)).toContainText("Changed meanwhile to:");
  await expect(otherValue(panel)).toHaveText("Zone");
  await expect(name).toHaveValue("Bereich");
  // the refusal's fresh page reached the canvas
  await expect(frameEl(page, "Zone")).toBeVisible();
  expect((await frameRow(area)).name).toBe("Zone");
});

test("S14A-01: a name save waiting behind a refused frame write is cut: Not saved, one toast; leaving the field saves it", async ({ page }) => {
  const area = await makeFrame(AREA, { name: "Area" });
  const before = await frameRow(area);
  const anna = FREE_FRAME_COLORS.find((c) => c !== before.color)!;
  const mine = FREE_FRAME_COLORS.find((c) => c !== before.color && c !== anna)!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hydrated(page);
  const panel = await openFrame(page, "Area");
  const name = panel.getByTestId("input-frame-name");

  // Anna changes the colour; this page's colour is refused, its answer held while the name's save waits behind it
  await changeFrameAsAnna(area, { color: anna });
  const hold = await holdUntil(page, area);
  await panel.getByRole("button", { name: `Colour ${mine}` }).click();
  await expect.poll(hold.held).toBe(true);
  await name.fill("Bereich");
  await name.press("Enter");
  hold.release();
  await hold.given;
  await expect(notSaved(panel)).toHaveText("Not saved");
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(name).toHaveValue("Bereich");
  expect((await frameRow(area)).name).toBe("Area");
  await page.waitForTimeout(500);
  expect((await toasts(page)).filter((t) => t === STALE)).toHaveLength(1);

  // the fresh page brought Anna's colour and the frame's new version: leaving the field again saves the name
  await name.click();
  await name.press("Enter");
  await expect.poll(async () => (await frameRow(area)).name).toBe("Bereich");
  await expect(notSaved(panel)).toHaveCount(0);
  expect((await frameRow(area)).color).toBe(anna);
});

test("S14A-01: a locked organization: no fresh page, the frame's name stays editable with Not saved", async ({ page }) => {
  const area = await makeFrame(AREA, { name: "Area" });
  // Anna also works in Retail Co; signing in there with its password leaves InfoMate locked in her session (S13-10)
  await addPerson(SEED_IDS.userMarek, SEED_IDS.wsSales, { name: "Anna", email: "anna.nowak@infomate.pl", role: "modeler" });
  await signInAs(page, "Anna Nowak");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hydrated(page);
  const panel = await openFrame(page, "Area");
  const other = await page.context().newPage();
  await other.goto(`/w/${SEED_IDS.wsRetailDwh}`);
  await signOutViaMenu(other);
  await signInWithPassword(other, "anna.nowak@infomate.pl", "Retail Co");
  await other.close();

  const name = panel.getByTestId("input-frame-name");
  await name.fill("Bereich");
  await name.press("Enter");
  await expectToast(page, "Unlock InfoMate first: open it and enter its password.");
  await expect(notSaved(panel)).toHaveText("Not saved");
  await expect(name).toHaveValue("Bereich");
  await expect(name).toHaveJSProperty("readOnly", false);
  expect((await frameRow(area)).name).toBe("Area");
});
