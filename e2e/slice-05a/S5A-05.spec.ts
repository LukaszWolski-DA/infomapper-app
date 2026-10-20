// S5A-05 (slice 5a, PRD items 7–10): the grips. While one is dragged the guide line follows the pointer within the
// limits and the panel keeps its width; on release the width is applied. Double-click resets (with the prototype's
// toast); on a focused grip ←/→ change the width by 16 px, Shift by 64 px, Home resets, each at once.

import { expect, test } from "./fixtures";
import {
  box,
  canvasArea,
  dragGrip,
  expectCanvasWidth,
  expectToast,
  grip,
  guide,
  guideX,
  openCanvas,
  panel,
  panelWidth,
  signInAs,
} from "./helpers";

test("S5A-05: the grips are separators with the prototype's title, at the panels' inner edges", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  for (const side of ["left", "right"] as const) {
    const g = grip(page, side);
    await expect(g).toHaveAttribute("role", "separator");
    await expect(g).toHaveAttribute("aria-orientation", "vertical");
    await expect(g).toHaveAttribute("tabindex", "0");
    await expect(g).toHaveAttribute("title", "Drag to resize; double-click to reset");
    const p = await box(panel(page, side)), b = await box(g);
    const edge = side === "left" ? p.x + p.width : p.x;
    expect(Math.abs((side === "left" ? b.x + b.width : b.x) - edge), side).toBeLessThanOrEqual(1);
  }
  await expect(grip(page, "left")).toHaveAttribute("aria-valuenow", "264");
  await expect(grip(page, "right")).toHaveAttribute("aria-valuenow", "340");
});

test("S5A-05: dragging moves only the guide line, within the limits; the release applies the width", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  const area = await box(canvasArea(page));
  await expect(guide(page)).toBeHidden();

  // the left grip, 100 px to the right: the guide at 364 px, the panel still 264 px
  await dragGrip(page, "left", 100, async () => {
    await expect(guide(page)).toBeVisible();
    expect(Math.abs((await guideX(page)) - 364)).toBeLessThanOrEqual(1.5);
    expect(await panelWidth(page, "left")).toBe(264);
    expect((await box(canvasArea(page))).width).toBe(area.width);
  });
  await expect(guide(page)).toBeHidden();
  await expect.poll(() => panelWidth(page, "left")).toBe(364);
  await expectCanvasWidth(page, area.width - 100);

  // far past the limits: the guide stops at them, and so does the width
  await dragGrip(page, "left", 600, async () => {
    expect(Math.abs((await guideX(page)) - 520)).toBeLessThanOrEqual(1.5);
  });
  await expect.poll(() => panelWidth(page, "left")).toBe(520);
  await dragGrip(page, "left", -600, async () => {
    expect(Math.abs((await guideX(page)) - 200)).toBeLessThanOrEqual(1.5);
  });
  await expect.poll(() => panelWidth(page, "left")).toBe(200);

  // the right grip: dragged left, the right panel widens; its limits are 280 and 640
  const right = page.viewportSize()!.width;
  await dragGrip(page, "right", -150, async () => {
    expect(Math.abs((await guideX(page)) - (right - 490))).toBeLessThanOrEqual(1.5);
    expect(await panelWidth(page, "right")).toBe(340);
  });
  await expect.poll(() => panelWidth(page, "right")).toBe(490);
  await dragGrip(page, "right", -600);
  await expect.poll(() => panelWidth(page, "right")).toBe(640);
  await dragGrip(page, "right", 900);
  await expect.poll(() => panelWidth(page, "right")).toBe(280);
});

test("S5A-05: double-click resets a panel to its default width, with a toast", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await dragGrip(page, "left", 120);
  await expect.poll(() => panelWidth(page, "left")).toBe(384);
  await grip(page, "left").dblclick();
  await expect.poll(() => panelWidth(page, "left")).toBe(264);
  await expectToast(page, "Left panel width reset.");

  await dragGrip(page, "right", -120);
  await expect.poll(() => panelWidth(page, "right")).toBe(460);
  await grip(page, "right").dblclick();
  await expect.poll(() => panelWidth(page, "right")).toBe(340);
  await expectToast(page, "Right panel width reset.");
});

test("S5A-05: the keyboard on a focused grip: ←/→ 16 px, Shift 64 px, Home resets, within the limits", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);

  await grip(page, "left").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => panelWidth(page, "left")).toBe(280);
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => panelWidth(page, "left")).toBe(344);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => panelWidth(page, "left")).toBe(328);
  await expect(grip(page, "left")).toHaveAttribute("aria-valuenow", "328");
  await page.keyboard.press("Home");
  await expect.poll(() => panelWidth(page, "left")).toBe(264);
  for (let i = 0; i < 2; i++) await page.keyboard.press("Shift+ArrowLeft");
  await expect.poll(() => panelWidth(page, "left")).toBe(200);
  await expect(grip(page, "left")).toBeFocused(); // the key stays on the grip

  // the right grip: → moves its edge right, so the panel narrows
  await grip(page, "right").focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => panelWidth(page, "right")).toBe(356);
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => panelWidth(page, "right")).toBe(292);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => panelWidth(page, "right")).toBe(280);
  await page.keyboard.press("Home");
  await expect.poll(() => panelWidth(page, "right")).toBe(340);
});
