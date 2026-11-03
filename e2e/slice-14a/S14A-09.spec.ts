import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeFrameAsAnna,
  conflictLine,
  expectToast,
  FRAMED,
  frameRow,
  groupsOf,
  hydrated,
  keepMine,
  makeFrame,
  openCanvas,
  openFrame,
  otherValue,
  recordToasts,
  signInAs,
  STALE,
  undo,
  useThis,
} from "./helpers";

// S14A-09 (item 13, F7, answer 6): a frame's name in its panel follows slice 13's rule. A conflict shows the line with
// "Use this" and "Keep mine"; "Keep mine" stores the draft as one change group and undo step; Escape while the line
// shows is "Use this"; a refused name stays when the panel closes and comes back with its line when the frame's panel
// opens again on the same page (`keep`), with slice 13's toast. The name is edited in the panel only (Q2).

const AREA = { x: 472, y: 0, width: 304, height: 856 };

test("S14A-09: a frame's name: the conflict line, Keep mine stores mine as one undo step; Escape takes Anna's", async ({ page }) => {
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
  await expect(otherValue(panel)).toHaveText("Zone");
  await keepMine(panel).click();
  await expect.poll(async () => (await frameRow(area)).name).toBe("Bereich");
  await expect(conflictLine(panel)).toHaveCount(0);
  const names = (await groupsOf(area)).map((g) => g.after?.name).filter(Boolean);
  expect(names.slice(-2)).toEqual(["Zone", "Bereich"]);
  await undo(page);
  await expect.poll(async () => (await frameRow(area)).name).toBe("Zone");
  await expect(name).toHaveValue("Zone");

  // again: Escape while the line shows takes Anna's name and stores nothing
  await changeFrameAsAnna(area, { name: "Region" });
  await name.fill("Gebiet");
  await name.press("Enter");
  await expect(otherValue(panel)).toHaveText("Region");
  await name.focus();
  await name.press("Escape");
  await expect(name).toHaveValue("Region");
  await expect(conflictLine(panel)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect((await frameRow(area)).name).toBe("Region");
});

test("S14A-09: Use this takes Anna's name; a refused name kept while the panel is closed comes back with its line", async ({ page }) => {
  const area = await makeFrame(AREA, { name: "Area" });
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await hydrated(page);
  let panel = await openFrame(page, "Area");
  let name = panel.getByTestId("input-frame-name");

  await changeFrameAsAnna(area, { name: "Zone" });
  await name.fill("Bereich");
  await name.press("Enter");
  await expect(otherValue(panel)).toHaveText("Zone");
  await useThis(panel).click();
  await expect(name).toHaveValue("Zone");
  await expect(conflictLine(panel)).toHaveCount(0);

  // a conflict, then the panel closes (Escape outside the field deselects the frame): the draft stays for the page
  await changeFrameAsAnna(area, { name: "Region" });
  await name.fill("Gebiet");
  await name.press("Enter");
  await expect(otherValue(panel)).toHaveText("Region");
  await expect(name).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("panel-frame")).toHaveCount(0);
  await expectToast(page, "Not saved: Name of Region. Open it again to see your text.");

  panel = await openFrame(page, "Region");
  name = panel.getByTestId("input-frame-name");
  await expect(name).toHaveValue("Gebiet");
  await expect(otherValue(panel)).toHaveText("Region");
  expect((await frameRow(area)).name).toBe("Region");
});
