// Slice 20's measuring sitting (Łukasz's step 3 instructions; AD-24's bars; `npm run measure:canvas -- --to-screen
// --only s20 --against slice-19`): on "Performance test", whose 1:N relationships without a copied key give header marks
// on this branch, (a) pan and zoom for 10 s at 100 % in the dense area (around src:57, as S1A-14) and at 30 % around the
// same point, rAF and, traced, as presented frames; (b) a write that adds a mark and its undo that removes it, to the
// screen: an attribute of a card in view renamed to its neighbour's name (a duplicate name on this branch), then undo
// (the mark goes) and redo (it comes back) by the keys, each from a settled screen, until the row shows its name.
// The same file runs on the reference (slice-19, which draws no mark): the same steps, so the A/B is the write's cost.
// Measurement build only; the normal e2e run leaves this file out (playwright.config.ts).

import { expect, test } from "../slice-01a/fixtures";
import { signInAs } from "../slice-01a/helpers";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";
import { MEASURE, MEASURE_USE, openLarge, panZoom, saveResults, startRecording, stopRecording } from "../slice-01b/measure";
import { tracedPan, tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, TO_SCREEN } from "../measure/trace";

test.use(MEASURE_USE);

const ROUNDS = 10;

test("S20 sitting: pan and zoom at 100 % and 30 % on Performance test; a mark's write and its undo to the screen", async ({ page }) => {
  test.skip(!MEASURE, "measuring only (MEASURE=1)");
  test.setTimeout(600_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const views: [string, { x: number; y: number; zoom: number }][] = [
    ["100%", { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 }],
    ["30%", { x: 768 - src57.x * 0.3, y: 300 - src57.y * 0.3, zoom: 0.3 }],
  ];
  const results: Record<string, unknown> = { pans: {} };
  for (const [name, view] of views) {
    await openLarge(page, view);
    await startRecording(page);
    await panZoom(page, 10_000);
    const raf = await stopRecording(page);
    let presented: unknown = null;
    if (TO_SCREEN) {
      await openLarge(page, view);
      presented = (await tracedPan(page, `S20 ${name}`, () => panZoom(page, 10_000))).presented;
    }
    (results.pans as Record<string, unknown>)[name] = { raf, presented };
  }

  // the write: an entity card of the generator with at least four rows (not the 200-row card), the view centred on it at
  // 100 %, its second attribute renamed to its third's name (Enter), stored
  const target = generate().cards.find((c) => c.kind === "ent" && c.id !== "ent:40" && c.rows.length >= 4)!;
  await openLarge(page, { x: 768 - target.x - 128, y: 200 - target.y, zoom: 1 });
  const row = await page.evaluate((name) => {
    for (const c of document.querySelectorAll<HTMLElement>('[data-testid="card-entity"]')) {
      if (c.querySelector('[data-testid="card-name"]')?.textContent !== name) continue;
      const rows = c.querySelectorAll<HTMLElement>("[data-row]");
      return { id: rows[1]!.dataset.row!, name: rows[1]!.querySelector(".nm")!.textContent!, to: rows[2]!.querySelector(".nm")!.textContent! };
    }
    return null;
  }, target.name);
  expect(row, `the card ${target.name} in view`).not.toBeNull();
  await page.locator(`[data-row="${row!.id}"]`).click();
  const field = page.getByTestId("input-attribute-name");
  await field.fill(row!.to);
  await field.press("Enter");
  const nameOf = () => page.locator(`[data-row="${row!.id}"] .nm`).textContent();
  await expect.poll(nameOf, { timeout: 20_000 }).toBe(row!.to);
  await field.blur();
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
  results.mark = await page.locator(`[data-row="${row!.id}"]`).evaluate((el) => el.classList.contains("chk"));

  // undo (off) and redo (on) by the keys, each from a settled screen, until the row shows its name
  const loop = () =>
    page.evaluate(
      async ([id, before, after, n, pause]) => {
        const shown = (text: string) => document.querySelector(`[data-row="${id}"] .nm`)?.textContent === text;
        const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
        const out: { dir: string; k: number; ms: number }[] = [];
        for (let k = 0; k < n; k++) {
          for (const dir of ["off", "on"] as const) {
            const t0 = performance.now();
            window.dispatchEvent(new KeyboardEvent("keydown", { key: dir === "off" ? "z" : "y", ctrlKey: true, bubbles: true, cancelable: true }));
            const want = dir === "off" ? before : after;
            while (!shown(want) && performance.now() - t0 < 10_000) await new Promise((res) => setTimeout(res, 0));
            if (!shown(want)) return { error: `write ${dir} ${k}: not shown` };
            await nextFrame();
            const t1 = performance.now();
            performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
            out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
            await new Promise((res) => setTimeout(res, pause));
          }
        }
        return out;
      },
      [row!.id, row!.name, row!.to, ROUNDS, PAUSE_MS] as const,
    ) as Promise<InPage>;
  if (TO_SCREEN) {
    const traced = await tracedSwitches(page, "S20 write", loop);
    if ("error" in traced) throw new Error(traced.error);
    results.write = { toScreen: traced };
  } else {
    const inPage = await loop();
    if ("error" in inPage) throw new Error(inPage.error);
    results.write = { inPage };
  }
  saveResults("S20-sitting", results);
});
