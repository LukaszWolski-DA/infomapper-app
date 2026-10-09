import { arrange, type ArrangeMode } from "../../src/canvas/arrange";
import { expect, test, type Page } from "./fixtures";
import { box, canvasUrl, card, closeToolbox, expectDrawnAt, expectToast, headPoint, ids, key, loadItems, openCanvas, rowNamed, signInAs, toolboxAt, WHOLE, zoomOf } from "./helpers";

const GROUP = ["Customer", "Sales Order", "Order Line"] as const;

test("S2A-05: the group toolbox offers the actions of item 7; Align left, Align top, Stack in a column, Line up in a row and Fit widths to names each give the prototype's result and are each one undo step", async ({ page }) => {
  const { entity, attribute } = await ids();
  const targets = GROUP.map((n) => entity(n).id);
  const items = async () => {
    const all = await loadItems();
    return targets.map((t) => all.find((i) => i.entity_id === t)!);
  };
  const positions = async () => (await items()).map((i) => ({ x: i.x, y: i.y }));
  const start = await positions();

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await selectGroup(page);

  // the group's toolbox, from a selected card's header
  expect(await toolboxAt(page, await headPoint(page, "Customer"))).toEqual([
    "Align left",
    "Align top",
    "Stack in a column",
    "Line up in a row",
    "Fit widths to names",
    "Put in a new frame", // slice 2b, PRD item 12
    "Add sources of selected entities",
    "Remove from this canvas",
    "Clear selection",
  ]);
  await expect(page.getByTestId("menu-toolbox")).toContainText("3 items selected");
  await closeToolbox(page);

  // a right-click on a row of a selected card opens that row's own toolbox (D-52 over the prototype, assumption 10)
  const rowItems = await toolboxAt(page, await rowPoint(page, "Customer", "email"));
  expect(rowItems.slice(0, 4)).toEqual(["Move up", "Move down", "Move to the top", "Move to the bottom"]);
  expect(rowItems).not.toContain("Align left");
  await expect(page.getByTestId("menu-toolbox")).toContainText(attribute("Customer", "email").name);
  await closeToolbox(page);

  // each arrangement: the prototype's rule (on the 8 px grid), one change, one Ctrl+Z puts every card back
  const zoom = await zoomOf(page);
  const rects = await Promise.all(
    GROUP.map(async (n, k) => {
      const b = await box(card(page, n).locator("[data-card]"));
      return { id: n, rect: { x: start[k]!.x, y: start[k]!.y, w: Math.round(b.width / zoom), h: Math.round(b.height / zoom) } };
    }),
  );
  const cases: [string, ArrangeMode, string][] = [
    ["Align left", "left", "Aligned to the left edge."],
    ["Align top", "top", "Aligned to the top edge."],
    ["Stack in a column", "column", "Stacked in a column."],
    ["Line up in a row", "row", "Lined up in a row."],
  ];
  for (const [label, mode, message] of cases) {
    const expected = arrange(mode, rects);
    await selectGroup(page);
    await runGroupAction(page, label);
    await expectToast(page, message);
    await expect.poll(positions, label).toEqual(GROUP.map((n) => expected.get(n)));
    for (const n of GROUP) await expectDrawnAt(page, n, expected.get(n)!);
    await key(page, "Control+z");
    await expectToast(page, /^Undone: Move cards?$/); // a card already in place is not written
    await expect.poll(positions, `${label} undone`).toEqual(start);
    for (const [k, n] of GROUP.entries()) await expectDrawnAt(page, n, start[k]!);
  }

  // Fit widths to names: every card gets the width “Fit width to names” gives it alone (D-37), in one change
  await selectGroup(page);
  await runGroupAction(page, "Fit widths to names");
  await expectToast(page, "Fitted 3 cards to their names.");
  // (null is the default width: a card that fits at 256 px keeps it)
  await expect.poll(async () => (await items()).some((i) => i.width !== null)).toBe(true);
  const fitted = (await items()).map((i) => i.width);
  await key(page, "Control+z");
  await expectToast(page, "Undone: Resize cards");
  await expect.poll(async () => (await items()).map((i) => i.width)).toEqual([null, null, null]);
  // and the page follows: every card is drawn at the default 256 px again
  for (const n of GROUP) await expect.poll(async () => Math.round((await box(card(page, n).locator("[data-card]"))).width / zoom), n).toBe(256);
  for (const [k, n] of GROUP.entries()) {
    await page.keyboard.press("Escape");
    await card(page, n).getByTestId("handle-card-width").dblclick();
    await expect.poll(async () => (await items())[k]!.width, n).toBe(fitted[k]);
  }
});

async function selectGroup(page: Page) {
  await page.keyboard.press("Escape");
  await page.getByTestId("card-name").getByText(GROUP[0], { exact: true }).click();
  await page.keyboard.down("Shift");
  for (const n of GROUP.slice(1)) {
    const at = await headPoint(page, n);
    await page.mouse.click(at.x, at.y);
  }
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("mark-selected")).toHaveCount(GROUP.length);
}

async function runGroupAction(page: Page, label: string) {
  await toolboxAt(page, await headPoint(page, "Customer"));
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: label }).click();
}

async function rowPoint(page: Page, cardName: string, rowName: string) {
  const r = await box(rowNamed(page, cardName, rowName));
  return { x: r.x + r.width / 3, y: r.y + r.height / 2 };
}
