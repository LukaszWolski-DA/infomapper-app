// S38-01 (slice 38, step 2): the canvas has its own toolbar. The canvas's controls leave the top bar and float in a
// toolbar at the canvas's top, in the PRD's order: what is shown, Focus and Changes, the tools (Hand, Entity, Note,
// Frame), the notation, “Names ▾” (slice 11's check boxes, same states and rights) and zoom; every control keeps its
// test id, title and shortcut; the working context and Undo and Redo stay in the top bar. “More” by the toolbar's own
// room (B2): at 1,280 px with both panels at their defaults every control is in the toolbar; a narrower canvas moves the
// names, then Focus, Changes and the notation, then the tools into “More”, each working from there. Fits and zoom to
// frame leave the toolbar's 70 px (F10); the Changes bar is under the toolbar (F9); the homes have no toolbar.

import { expect, test } from "./fixtures";
import {
  AROUND,
  canvasTop,
  canvasUrl,
  clickBox,
  contextOn,
  entityBox,
  expectBox,
  expectToolbarFits,
  frameEl,
  makeFrame,
  openCanvas,
  projectPath,
  setPanels,
  signInAs,
  toolbar,
  toolbarIds,
  topBar,
  WS_HOME,
} from "./helpers";

const ORDER = [
  "switch-layer",
  "button-focus",
  "button-changes",
  "button-tool-hand",
  "button-tool-entity",
  "button-tool-note",
  "button-tool-frame",
  "switch-notation",
  "button-names",
  "group-zoom",
];
const TITLES: Record<string, string> = {
  "button-focus": "Fade everything not connected to the selection",
  "button-tool-hand": "Hand tool (H): drag anywhere to move the canvas. V or Esc returns to selecting",
  "button-tool-entity": "Entity tool (E): click on the canvas to create a new entity there",
  "button-zoom-fit": "Fit everything on screen (F)",
};

test("S38-01: the canvas's controls are in its toolbar, in order, with their titles and shortcuts; the top bar keeps the context and Undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await contextOn(page, "CR-23");
  await openCanvas(page, canvasUrl());
  expect(page.viewportSize()?.width).toBe(1280);

  // the PRD's order, every control in the toolbar at 1,280 px with both panels at their defaults, no “More”, no scroll
  expect(await toolbarIds(page)).toEqual(ORDER);
  await expect(page.getByTestId("button-more-tools")).toBeHidden();
  await expectToolbarFits(page);
  await expect(toolbar(page)).toHaveAttribute("role", "toolbar");

  // the top bar keeps the path, the working context, Undo and Redo, the save pair, the toggles and the user
  for (const id of ["button-context", "group-undo", "group-save", "button-toggle-left", "button-toggle-right", "indicator-user"]) await expect(topBar(page).getByTestId(id)).toBeVisible();
  for (const id of ORDER) await expect(topBar(page).getByTestId(id)).toHaveCount(0);

  // titles word for word, and an icon's name for assistive technology
  for (const [id, title] of Object.entries(TITLES)) await expect(page.getByTestId(id)).toHaveAttribute("title", title);
  await expect(page.getByRole("button", { name: "Entity tool (E)", exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="switch-layer"] [data-layer="all"]')).toHaveText("All");
  await expect(page.locator('[data-testid="switch-layer"] [data-layer="all"]')).toHaveAttribute("title", "Everything");

  // shortcuts as before: E and H press their tools, Escape ends them; the layer switch works from the toolbar
  await page.locator(".react-flow__pane").click({ position: { x: 300, y: 400 } });
  await page.keyboard.press("e");
  await expect(page.getByTestId("button-tool-entity")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("h");
  await expect(page.getByTestId("button-tool-hand")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await expect(page.locator('[data-testid="switch-layer"] [data-layer="mappings"]')).toHaveAttribute("aria-pressed", "true");
});

test("S38-01: “Names ▾” holds the two check boxes with their states and rights", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const menu = page.getByTestId("menu-names");
  await expect(menu).toBeHidden();
  // shut, the boxes are in the page and read as before
  await expectBox(entityBox(page), "name");
  await page.getByTestId("button-names").click();
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Entity aliases", { exact: true })).toBeVisible();
  await expect(menu.getByText("Attribute aliases", { exact: true })).toBeVisible();
  await clickBox(page, entityBox(page));
  await expectBox(entityBox(page), "alias");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expectBox(entityBox(page), "alias");

  // a reviewer opens it and sees the boxes disabled, with the read-only title
  await signInAs(page, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl());
  await page.getByTestId("button-names").click();
  await expect(entityBox(page)).toBeDisabled();
  await expect(page.getByTestId("switch-names").locator("label").first()).toHaveAttribute("title", "Only editors change what this canvas shows");
});

test("S38-01: on a narrower canvas the names, then Focus and the notation, then the tools move into “More”, each working there", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const more = page.getByTestId("menu-more-tools");

  // the right panel at 380 px: a 636 px canvas, 612 px of room: only “Names ▾” leaves
  await setPanels(page, 264, 380);
  await openCanvas(page, canvasUrl());
  expect(await toolbarIds(page)).toEqual([...ORDER.filter((id) => id !== "button-names"), "button-more-tools"]);
  await expectToolbarFits(page);
  await page.getByTestId("button-more-tools").click();
  await expect(more.getByTestId("more-entity-aliases")).toBeVisible();
  await expect(more.getByTestId("more-focus")).toBeHidden();
  await expect(more.getByTestId("more-tool-hand")).toBeHidden();
  await more.getByTestId("more-entity-aliases").click();
  await expectBox(entityBox(page), "alias");
  await page.keyboard.press("Escape");

  // 1,100 px with both panels at their defaults: a 496 px canvas: the names, Focus, Changes and the notation leave
  await setPanels(page, 264, 340);
  await page.setViewportSize({ width: 1100, height: 770 });
  await openCanvas(page, canvasUrl());
  expect(await toolbarIds(page)).toEqual(["switch-layer", "button-tool-hand", "button-tool-entity", "button-tool-note", "button-tool-frame", "group-zoom", "button-more-tools"]);
  await expectToolbarFits(page);
  await page.getByTestId("button-more-tools").click();
  await expect(more.getByTestId("more-focus")).toBeVisible();
  await expect(more.getByTestId("more-changes")).toBeVisible();
  await expect(more.getByTestId("more-tool-hand")).toBeHidden();
  await more.locator('[data-notation="uml"]').click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-notation", "uml");

  // the right panel at 640 px: a 196 px canvas: the tools leave too; the toolbar keeps the layer switch and zoom
  await setPanels(page, 264, 640);
  await page.setViewportSize({ width: 1280, height: 770 });
  await openCanvas(page, canvasUrl());
  expect(await toolbarIds(page)).toEqual(["switch-layer", "group-zoom", "button-more-tools"]);
  await page.getByTestId("button-more-tools").click();
  for (const id of ["more-tool-hand", "more-tool-entity", "more-tool-note", "more-tool-frame"]) await expect(more.getByTestId(id)).toBeVisible();
  await more.getByTestId("more-tool-hand").click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "hand");
});

test("S38-01: a fit and zoom to frame leave the toolbar's room; the Changes bar is under the toolbar", async ({ page }) => {
  await makeFrame(AROUND.customer, { name: "Top frame" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());

  // Fit (F): the highest card stands at least 70 px below the canvas's top, under the toolbar's 50 px
  await page.locator(".react-flow__pane").click({ position: { x: 300, y: 400 } });
  await page.keyboard.press("f");
  await expect.poll(async () => (await canvasTop(page)).first, { message: "a fit leaves 70 px" }).toBeGreaterThanOrEqual(69);
  expect((await canvasTop(page)).toolbarBottom).toBe(50);

  // Zoom to frame: the frame below the room
  await frameEl(page, "Top frame").getByTestId("frame-name").click();
  await page.getByTestId("button-frame-zoom").click();
  await expect.poll(async () => (await canvasTop(page, '[data-testid="frame"]')).first).toBeGreaterThanOrEqual(69);

  // the Changes bar: 8 px under the toolbar
  await page.getByTestId("button-changes").click();
  const changes = await page.getByTestId("bar-changes").boundingBox();
  const bar = await toolbar(page).boundingBox();
  expect(changes!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height + 7);
});

test("S38-01: the workspace and project homes have no canvas toolbar", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectPath());
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(toolbar(page)).toHaveCount(0);
  await page.goto(WS_HOME);
  await expect(page.getByTestId("bar-top")).toBeVisible();
  await expect(toolbar(page)).toHaveCount(0);
});
