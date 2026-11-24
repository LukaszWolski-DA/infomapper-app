// S35-04 (slice 35, criterion 4 as changed, section 8 of the acceptance doc; B1.6, B2.3, B4.2, B4.6): every member sees
// "Compare…" on each baseline, in an archived workspace too. "Compared with" (Now by default, or any other baseline,
// newest first), "Filter" and "Kind" in one row; the older state is always the start; the line, the groups Added,
// Changed and Removed, each a table of Kind, Item and What changed; short values old → new, long texts "(changed)", ids
// by name. "cust" finds customers.cust_no, Customer.segment_code and the mapping from cust_no. Locally the demo's
// "Stage 1 sign-off" compared with Now shows the mapping whose status changed and customers.cust_no's type. A baseline
// gone meanwhile: "This baseline no longer exists." (F17).
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures";
import { baselineFolder } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { clickVisible } from "../canvas-click";
import { canvasUrl, card, loadModel, openCanvas } from "../slice-01a/helpers";
import { deleteBaseline } from "../../src/domain/commands/baseline";
import { archive, asPersonHere, compareRows, createInBox, DEMO_BASELINE, expectToast, minute, openBaselines, openCompare, rowNamed, signInAs, SEED_IDS, storedBaseline } from "./helpers";

test.use({ seed: "full" });

const STAGE1 = [
  "Attribute | Customer.segment_code | ",
  "Mapping | customers.cust_no → Customer.customer_number | status: Draft → Approved",
  "Requirement | REQ-105 Personal data is encrypted at rest | ",
  "Source column | CRM · customers.cust_no | type: varchar(10) → varchar(20)",
];

test("S35-04: Compare… with Now and with another baseline, the line, the groups, the filter and the kind", async ({ page }) => {
  // a Reader (a guest) compares
  await signInAs(page, "Kasia Zielińska");
  await openBaselines(page);
  let dialog = await openCompare(page, DEMO_BASELINE.name);
  await expect(dialog.getByTestId("text-dialog-subtitle")).toHaveText("Retail Co – DWH");
  await expect(dialog.getByRole("heading", { name: `Compare “${DEMO_BASELINE.name}”` })).toBeVisible();
  const at = minute(DEMO_BASELINE.at);
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now.`);
  // the groups in order, each a table
  await expect(dialog.locator("h4")).toHaveText(["Added (2)", "Changed (2)"]);
  await expect(dialog.locator("[data-testid=compare-group-added] th")).toHaveText(["Kind", "Item", "What changed"]);
  expect(await compareRows(dialog)).toEqual([STAGE1[0], STAGE1[2], STAGE1[1], STAGE1[3]]);
  // the controls in one row at 1440 px: the same top for all three
  const tops = await topsOf(dialog);
  // a search input and a select may differ by half a pixel
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
  await expect(dialog.getByTestId("select-compare-with").locator("option")).toHaveText(["Now (the live model)"]);
  await expect(dialog.getByTestId("select-compare-kind").locator("option")).toHaveText(["All kinds", "Entity", "Attribute", "Mapping", "Relationship", "Requirement", "Source table", "Source column"]);
  await expect(dialog.getByTestId("input-compare-filter")).toHaveAttribute("placeholder", "A name, e.g. Customer or cust_no");

  // the filter in any letter case, the kind, nothing left
  await dialog.getByTestId("input-compare-filter").fill("CUST");
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now; 3 shown by the filter.`);
  expect(await compareRows(dialog)).toEqual([STAGE1[0], STAGE1[1], STAGE1[3]]);
  await dialog.getByTestId("select-compare-kind").selectOption({ label: "Source column" });
  expect(await compareRows(dialog)).toEqual([STAGE1[3]]);
  await dialog.getByTestId("input-compare-filter").fill("nothing like this");
  await expect(dialog.getByTestId("text-compare-nothing")).toHaveText("Nothing matches the filter.");
  await dialog.getByTestId("button-close-compare").click();

  // another baseline, newer: whichever row it is opened from, the older state is the start
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await createInBox(page, "Stage 2 sign-off");
  await expectToast(page, "Created the baseline Stage 2 sign-off.");
  const stage2 = minute((await storedBaseline("Stage 2 sign-off"))!.created_at);
  dialog = await openCompare(page, "Stage 2 sign-off");
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`No changes from “Stage 2 sign-off” (${stage2}) to now.`);
  await expect(dialog.getByTestId("select-compare-with").locator("option")).toHaveText(["Now (the live model)", `${DEMO_BASELINE.name} (${at})`]);
  await dialog.getByTestId("select-compare-with").selectOption({ label: `${DEMO_BASELINE.name} (${at})` });
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to “Stage 2 sign-off” (${stage2}).`);
  expect(await compareRows(dialog)).toEqual([STAGE1[0], STAGE1[2], STAGE1[1], STAGE1[3]]);
  await dialog.getByTestId("button-close-compare").click();
  dialog = await openCompare(page, DEMO_BASELINE.name);
  await expect(dialog.getByTestId("select-compare-with").locator("option")).toHaveText(["Now (the live model)", `Stage 2 sign-off (${stage2})`]);
  await dialog.getByTestId("select-compare-with").selectOption({ label: `Stage 2 sign-off (${stage2})` });
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to “Stage 2 sign-off” (${stage2}).`);

  // gone meanwhile (F17): the next answer says so and the dialog closes
  const s2 = (await storedBaseline("Stage 2 sign-off"))!;
  await asPersonHere(SEED_IDS.userLukasz, (ctx, access) => deleteBaseline(ctx, access, s2, { baselineId: s2.id, expectedVersion: s2.version }));
  // Now still compares; the deleted one, chosen again, is gone
  await dialog.getByTestId("select-compare-with").selectOption({ label: "Now (the live model)" });
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now.`);
  await dialog.getByTestId("select-compare-with").selectOption({ label: `Stage 2 sign-off (${stage2})` });
  await expectToast(page, "This baseline no longer exists.");
  await expect(dialog).toHaveCount(0);
  await expect(rowNamed(page, "Stage 2 sign-off")).toHaveCount(0);

  // archived: Compare stays
  await archive();
  await page.reload();
  dialog = await openCompare(page, DEMO_BASELINE.name);
  await expect(dialog.getByTestId("text-compare-line")).toHaveText(`4 changes from “${DEMO_BASELINE.name}” (${at}) to now.`);
});

test("S35-04: on a narrow window the three controls wrap", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 900 });
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  const dialog = await openCompare(page, DEMO_BASELINE.name);
  const tops = await topsOf(dialog);
  expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(20);
  // the page has no horizontal scroll
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

/** The three controls' tops, read in one go (the centred dialog moves while its list grows). */
const topsOf = (dialog: import("@playwright/test").Locator) =>
  dialog.evaluate((d) => ["select-compare-with", "input-compare-filter", "select-compare-kind"].map((id) => d.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top));

// Step 5 (Łukasz's acceptance, bug 2): a list longer than the dialog scrolls to its very end; the last row of the last
// group is fully inside the dialog's visible body, above the footer, and nothing is wider than the dialog. The long list:
// the demo's baseline written without its attributes (every attribute added) and with long technical names for its
// source columns, unbroken as a real source's (every column changed: name: LONG_NAME → name). The long names were the
// cause: the table grew wider than the dialog, a horizontal scroll bar took the list's last line and the right column was
// cut off. 1440 × 900 and 1280 × 720, light and dark.
for (const [width, height] of [[1440, 900], [1280, 720]] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`S35-04: a long list scrolls to its last row at ${width} × ${height}, ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme });
      const file = path.join(baselineFolder(E2E_DB), `${DEMO_BASELINE.id}.json`);
      const content = JSON.parse(fs.readFileSync(file, "utf8")) as { model: { attributes: unknown[]; sourceColumns: { name: string }[] } };
      content.model.attributes = [];
      for (const c of content.model.sourceColumns) c.name = `COLUMN_WITH_A_VERY_LONG_TECHNICAL_NAME_${c.name.toUpperCase()}_FROM_THE_SOURCE_SYSTEM`;
      fs.writeFileSync(file, JSON.stringify(content));
      await signInAs(page, "Łukasz");
      await openBaselines(page);
      const dialog = await openCompare(page, DEMO_BASELINE.name);
      const body = dialog.getByTestId("dialog-body");
      const rows = dialog.getByTestId("compare-row");
      expect(await rows.count()).toBeGreaterThan(40);
      // the body is a scroll container, the list longer than it
      if (process.env.SCREENS) await page.screenshot({ path: path.join(process.env.SCREENS, `compare-long-${width}x${height}-${scheme}.png`) });
      const sizes = await body.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
      expect(sizes.scroll).toBeGreaterThan(sizes.client);
      // nothing wider than the dialog: no horizontal scroll bar under the list
      expect(sizes.scrollWidth, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.clientWidth);
      // scroll to the end with the wheel, as a person does, until it stops moving
      const box = (await body.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect
        .poll(async () => {
          await page.mouse.wheel(0, 800);
          return body.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
        })
        .toBeLessThan(1);
      const geo = await dialog.evaluate((d) => {
        const r = (el: Element) => el.getBoundingClientRect();
        const b = r(d.querySelector('[data-testid="dialog-body"]')!);
        const f = r(d.querySelector('[data-testid="dialog-footer"]')!);
        const rows = d.querySelectorAll('[data-testid="compare-row"]');
        const l = r(rows[rows.length - 1]!);
        const el = d.querySelector('[data-testid="dialog-body"]')!;
        // the body's visible area: its client box (a scroll bar under the list is not part of it)
        const visibleBottom = b.top + el.clientTop + el.clientHeight;
        return { body: { top: b.top, bottom: visibleBottom }, footer: f.top, row: { top: l.top, bottom: l.bottom, right: l.right }, bodyRight: b.left + el.clientLeft + el.clientWidth, dialog: r(d).bottom, vh: window.innerHeight, atEnd: Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 1 };
      });
      expect(geo.atEnd, JSON.stringify(geo)).toBe(true);
      expect(geo.row.bottom, JSON.stringify(geo)).toBeLessThanOrEqual(geo.body.bottom + 0.5);
      expect(geo.row.bottom, JSON.stringify(geo)).toBeLessThanOrEqual(geo.footer + 0.5);
      expect(geo.row.top).toBeGreaterThanOrEqual(geo.body.top);
      expect(geo.row.right, JSON.stringify(geo)).toBeLessThanOrEqual(geo.bodyRight + 0.5);
      expect(geo.dialog).toBeLessThanOrEqual(geo.vh);
      await expect(rows.last()).toBeInViewport({ ratio: 1 });
      if (process.env.SCREENS) await page.screenshot({ path: path.join(process.env.SCREENS, `compare-end-${width}x${height}-${scheme}.png`) });
    });
  }
}

// Step 5 (bug 2): the Rename and Delete dialogs the same way: with a 120-character unbroken name, nothing is wider than
// the dialog, the whole dialog is on the screen, and its text ends above the footer. 1280 × 720, light and dark.
for (const scheme of ["light", "dark"] as const) {
  test(`S35-04: Rename and Delete with a long unbroken name fit the dialog at 1280 × 720, ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ colorScheme: scheme });
    const name = "B".repeat(120);
    await signInAs(page, "Łukasz");
    await openBaselines(page);
    await createInBox(page, name, "N".repeat(400));
    await expectToast(page, `Created the baseline ${name}.`);
    // the list's row too: its name and note break, nothing runs past the row
    const overflowing = await rowNamed(page, name).evaluate((row) => {
      const right = row.getBoundingClientRect().right;
      return [...row.querySelectorAll("*")].filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > right + 0.5).map((el) => el.tagName + (el.getAttribute("data-testid") ?? ""));
    });
    expect(overflowing).toEqual([]);
    for (const [button, dialogId, textId] of [
      ["button-baseline-rename", "dialog-rename-baseline", "text-rename-baseline"],
      ["button-baseline-delete", "dialog-delete-baseline", "text-delete-baseline"],
    ] as const) {
      await rowNamed(page, name).getByTestId(button).click();
      const dialog = page.getByTestId(dialogId);
      await expect(dialog.getByTestId(textId)).toBeVisible();
      const geo = await dialog.evaluate((d, id) => {
        const body = d.querySelector('[data-testid="dialog-body"]')!;
        const b = body.getBoundingClientRect();
        const t = d.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        // no element's text runs past its box, nor any box past the dialog (the title holds the name)
        const right = d.getBoundingClientRect().right;
        const wide = [...d.querySelectorAll("*")].filter((el) => (!el.matches("input, textarea") && el.scrollWidth > el.clientWidth + 1) || el.getBoundingClientRect().right > right + 0.5).map((el) => el.tagName + (el.getAttribute("data-testid") ?? ""));
        return { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, textBottom: t.bottom, visibleBottom: b.top + body.clientTop + body.clientHeight, dialogBottom: d.getBoundingClientRect().bottom, vh: window.innerHeight, wide };
      }, textId);
      expect(geo.scrollWidth, JSON.stringify(geo)).toBeLessThanOrEqual(geo.clientWidth);
      expect(geo.wide, JSON.stringify(geo)).toEqual([]);
      expect(geo.textBottom, JSON.stringify(geo)).toBeLessThanOrEqual(geo.visibleBottom + 0.5);
      expect(geo.dialogBottom).toBeLessThanOrEqual(geo.vh);
      if (process.env.SCREENS) await page.screenshot({ path: path.join(process.env.SCREENS, `${dialogId}-1280x720-${scheme}.png`) });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  });
}

// Step 5 (Łukasz's acceptance, bug 1): references are compared by id and shown by name. Through the page alone: Customer
// renamed and customers.dob → Customer.birth_date approved give exactly two changes, not the mappings to Customer's
// attributes.
test("S35-04: Customer renamed and one mapping approved, through the page: exactly two changes", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await createInBox(page, "Before the rename");
  await expectToast(page, "Created the baseline Before the rename.");
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer" && e.model_level === "logical")!;
  const birth = model.attributes.find((a) => a.entity_id === customer.id && a.name === "birth_date")!;
  expect(model.mappings.find((m) => m.attribute_id === birth.id)!.status).toBe("review");

  // a view with the cards' rows drawn
  await openCanvas(page, canvasUrl(), { x: 10, y: 10, zoom: 1 });
  await clickVisible(card(page, "Customer").getByTestId("card-name"));
  const name = page.getByTestId("input-entity-name");
  await name.fill("Client");
  await name.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)!.name).toBe("Client");
  await clickVisible(card(page, "Client").locator(`[data-row="${birth.id}"]`));
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  const panel = page.getByTestId("panel-mapping");
  await panel.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved" }).click();
  await expect.poll(async () => (await loadModel()).mappings.find((m) => m.attribute_id === birth.id)!.status).toBe("approved");

  await openBaselines(page);
  const dialog = await openCompare(page, "Before the rename");
  expect(await compareRows(dialog)).toEqual(["Entity | Client | name: Customer → Client", "Mapping | customers.dob → Client.birth_date | status: In review → Approved"]);
});
