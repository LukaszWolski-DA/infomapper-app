// S5A-02 (slice 5a, PRD items 3–4, 11): hidden panels survive a reload, a move to another canvas and to the project
// home; a storage error leaves the panels shown. Step 2 covers the shown and hidden state; the widths come with the
// grips in step 3.

import { expect, test } from "./fixtures";
import { SEED_IDS, canvasIn, expectHidden, expectShown, openCanvas, panelsCookie, projectHome, signInAs, togglePanel } from "./helpers";

test("S5A-02: hidden panels are remembered across a reload, another canvas and the project home", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await togglePanel(page, "left");
  expect(await panelsCookie(page)).toBe("l0.r1.264.340");

  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectHidden(page, "left");
  await expectShown(page, "right");

  await openCanvas(page, canvasIn(SEED_IDS.projOrderManagement, SEED_IDS.canvasOrderLines));
  await expectHidden(page, "left");
  await togglePanel(page, "right");
  await expectHidden(page, "right");

  await page.goto(projectHome());
  await expect(page.getByTestId("page-project-home")).toBeVisible();
  await expectHidden(page, "left");
  await expectHidden(page, "right");
  // the project home's buttons work the same way, and the canvas follows
  await togglePanel(page, "left");
  await expectShown(page, "left");
  await openCanvas(page);
  await expectShown(page, "left");
  await expectHidden(page, "right");
});

test("S5A-02: the layout is per person", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await togglePanel(page, "left");
  await signInAs(page, "Anna Nowak");
  await openCanvas(page);
  await expectShown(page, "left");
});

test("S5A-02: an unreadable cookie leaves both panels shown", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const url = new URL(page.url());
  await page.context().addCookies([{ name: `im-panels.${SEED_IDS.userLukasz}`, value: "l0.r0.garbage", domain: url.hostname, path: "/" }]);
  await openCanvas(page);
  await expectShown(page, "left");
  await expectShown(page, "right");
});

test("S5A-02: blocked cookies: the buttons still work, nothing is remembered, the panels show after a reload", async ({ page }) => {
  await page.addInitScript(() => {
    const proto = Document.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "cookie")!;
    Object.defineProperty(proto, "cookie", {
      configurable: true,
      get() {
        return original.get!.call(this);
      },
      set(v: string) {
        if (v.startsWith("im-panels.")) throw new DOMException("blocked", "SecurityError");
        original.set!.call(this, v);
      },
    });
  });
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await togglePanel(page, "left");
  await expectHidden(page, "left");
  expect(await panelsCookie(page)).toBeUndefined();
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectShown(page, "left");
});
