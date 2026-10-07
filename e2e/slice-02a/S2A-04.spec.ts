import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, headPoint, ids, key, loadItems, openCanvas, signInAs, WHOLE } from "./helpers";

test("S2A-04: arrow keys move the selection by 8 px, with Shift by 32 px; five quick presses are one undo step", async ({ page }) => {
  const { entity, table } = await ids();
  const targets = [entity("Customer").id, table("web_users").id];
  const positions = async () => {
    const items = await loadItems();
    return targets.map((t) => {
      const i = items.find((x) => x.entity_id === t || x.source_table_id === t)!;
      return { x: i.x, y: i.y };
    });
  };
  const shifted = (from: { x: number; y: number }[], dx: number, dy: number) => from.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  const start = await positions();

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.getByTestId("card-name").getByText("Customer", { exact: true }).click();
  const at = await headPoint(page, "web_users");
  await page.keyboard.down("Shift");
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("mark-selected")).toHaveCount(2);

  // → moves both by 8 px; Shift+↓ by 32 px
  await page.keyboard.press("ArrowRight");
  await expect.poll(positions).toEqual(shifted(start, 8, 0));
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(positions).toEqual(shifted(start, 8, 32));
  await expect(page.getByTestId("mark-selected")).toHaveCount(2); // still selected

  // five quick presses: the cards move at once, and the moves are saved as one step after the keys are still
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await expect.poll(positions).toEqual(shifted(start, -32, 32));
  await key(page, "Control+z");
  await expectToast(page, "Undone: Move cards");
  await expect.poll(positions).toEqual(shifted(start, 8, 32));
  // the two earlier nudges were steps of their own
  await key(page, "Control+z");
  await expect.poll(positions).toEqual(shifted(start, 8, 0));
  await key(page, "Control+z");
  await expect.poll(positions).toEqual(start);
});
