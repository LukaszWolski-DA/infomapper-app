import { expect, test } from "./fixtures";
import { canvasUrl, card, closeToolbox, emptySpot, ids, loadItems, loadModel, openCanvas, pointOnLine, rowNamed, signInAs, toolboxAt } from "./helpers";

test("S1B-07: the Entity tool and “New entity here” create an entity at the clicked spot with the name ready to type; the toolbox offers the actions listed for each kind of item", async ({ page }) => {
  const { model, attribute } = await ids();
  await signInAs(page, "Łukasz");
  // at 100%, scrolled down to an empty part of the canvas: a point in the view is (x, y + 900) on the canvas
  await openCanvas(page, canvasUrl(), { x: 0, y: -900, zoom: 1 });
  const nameField = page.getByTestId("input-entity-name");
  const area = (await page.locator(".react-flow__pane").boundingBox())!; // the canvas itself, where (0, 0) of the view is

  // the Entity tool: the next click creates an entity there (its card at the click − 24, − 20);
  await page.getByTestId("button-tool-entity").click();
  await page.mouse.click(area.x + 300, area.y + 200);
  await expect(nameField).toBeFocused();
  await expect(nameField).toHaveValue("New entity");
  await page.keyboard.type("Loyalty Card");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Loyalty Card")).toBe(true);
  const loyalty = (await loadModel()).entities.find((e) => e.name === "Loyalty Card")!;
  const placed = (await loadItems()).find((i) => i.entity_id === loyalty.id)!;
  expect(Math.abs(placed.x - (300 - 24))).toBeLessThanOrEqual(8); // the click and the card both snap to 8 px
  expect(Math.abs(placed.y - (1100 - 20))).toBeLessThanOrEqual(8);

  // the empty canvas: search, “New entity here”, “Fit everything on screen”
  const onCanvas = await toolboxAt(page, await emptySpot(page));
  expect(onCanvas).toEqual(expect.arrayContaining(["New entity here", "Fit everything on screen"]));
  await expect(page.getByTestId("input-toolbox-search")).toBeVisible();
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: /New entity here/ }).click();
  await expect(nameField).toBeFocused();
  await expect(nameField).toHaveValue("New entity");
  await expect.poll(async () => (await loadModel()).entities.length).toBe(model.entities.length + 2);
  await nameField.blur();
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 1 });

  // a card: its sources, relate, rows, collapse, fit width, remove, delete
  const head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  const onCard = await toolboxAt(page, { x: head.x + 20, y: head.y + 10 });
  for (const item of ["Sources are all on this canvas", "Draw a relationship from here", "Collapse card", "Fit width to names", "Remove from this canvas", "Delete from model…"]) {
    expect(onCard, item).toContain(item);
  }
  await expect(page.getByTestId("menu-toolbox").getByText("Rows", { exact: true })).toBeVisible();
  // collapse from the toolbox, and the entry turns into “Expand card”, which expands it again
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Collapse card" }).click();
  const customerCard = (await card(page, "Customer").locator("[data-card]").getAttribute("data-card"))!;
  await expect(card(page, "Customer").locator(".row[data-row]")).toHaveCount(0);
  await expect.poll(async () => (await loadItems()).find((i) => i.id === customerCard)!.collapsed).toBe(true);
  const onCollapsed = await toolboxAt(page, { x: head.x + 20, y: head.y + 10 });
  expect(onCollapsed).toContain("Expand card");
  expect(onCollapsed).not.toContain("Collapse card");
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Expand card" }).click();
  await expect(card(page, "Customer").locator(".row[data-row]")).toHaveCount(8);
  await expect.poll(async () => (await loadItems()).find((i) => i.id === customerCard)!.collapsed).toBe(false);
  expect(await toolboxAt(page, { x: head.x + 20, y: head.y + 10 })).toContain("Collapse card");
  await closeToolbox(page);

  // an attribute row: only the row's actions, no card actions (D-52)
  const email = (await rowNamed(page, "Customer", "email").boundingBox())!;
  const onRow = await toolboxAt(page, { x: email.x + 30, y: email.y + email.height / 2 });
  expect(onRow).toEqual(["Move up", "Move down", "Move to the top", "Move to the bottom", "Map from a column…", "Delete attribute"]);
  await expect(page.getByTestId("menu-toolbox").getByText("Rows", { exact: true })).toHaveCount(0);
  await closeToolbox(page);

  // a column row: only the row's action (D-52)
  const segment = (await rowNamed(page, "customers", "segment").boundingBox())!;
  expect(await toolboxAt(page, { x: segment.x + 30, y: segment.y + segment.height / 2 })).toEqual(["Map to an attribute…"]);
  await closeToolbox(page);

  // a mapping line: status, edit rule, delete
  const mapping = model.mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const line = page.getByTestId("layer-lines").locator(`[data-testid="line-mapping"][data-mapping="${mapping.id}"]`);
  const onMap = await toolboxAt(page, await pointOnLine(line));
  for (const item of ["Draft", "In review", "Approved", "Edit transformation rule…", "Delete mapping"]) expect(onMap, item).toContain(item);
  await closeToolbox(page);

  // a relationship line: edit, swap direction, delete
  const rel = page.getByTestId("layer-lines").locator('[data-testid="line-relationship"]').first();
  const onRel = await toolboxAt(page, await pointOnLine(rel, 0.3));
  for (const item of ["Edit name and cardinality…", "Swap direction", "Delete relationship"]) expect(onRel, item).toContain(item);
  await closeToolbox(page);
});
