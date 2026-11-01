import { deleteCanvas } from "../../src/domain/commands/canvas";
import { signInWithPassword } from "../slice-08/helpers";
import { expect, test } from "./fixtures";
import { asLukasz, OL, OM, OM_HOME, RETAIL, SEED_IDS, signInAs, store, thumbnailHref, tileOf } from "./helpers";

// S12B-09 (PRD P5; step 1, F17): each tile's thumbnail is in the server's HTML as an `<svg>` referring to its drawing
// at an address with the drawing's key, drawn with JavaScript off; the address answers only a person who may open the
// workspace (401 without a session, 404 for no membership or a canvas deleted or outside the workspace, 403 for a
// locked organization), immutable under its key and uncached under another; a reader and a reviewer get the owner's
// drawing. (No layout read and no client code: the review's grep in the acceptance.)

const path = (ws: string, canvas: string) => `/w/${ws}/thumbnail/${canvas}`;

test("S12B-09: the thumbnails are in the server's HTML and drawn without JavaScript", async ({ page, browser }) => {
  await signInAs(page, "Łukasz");
  const html = await (await page.request.get(OM_HOME)).text();
  const hrefs = [...html.matchAll(/<svg[^>]*data-testid="tile-thumbnail"[^>]*><use href="([^"#]+)#t"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  expect(hrefs).toHaveLength(2);
  expect(hrefs.every((h) => /^\/w\/[\w-]+\/thumbnail\/[\w-]+\?v=[\w-]{16}$/.test(h))).toBe(true);

  // JavaScript off: the strip's <use> still fetches and draws its drawing
  const context = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() });
  const plain = await context.newPage();
  const drawn = plain.waitForResponse((r) => r.url().includes("/thumbnail/") && r.status() === 200);
  await plain.goto(OM_HOME);
  expect((await drawn).headers()["content-type"]).toContain("image/svg+xml");
  await expect(plain.getByTestId("tile-thumbnail")).toHaveCount(2);
  await context.close();
});

test("S12B-09: the drawing's address answers as the workspace's pages do, and caches only under its key", async ({ page, browser, playwright }) => {
  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  const href = (await thumbnailHref(tileOf(page, "Order lines & products")))!;
  const owner = await page.request.get(href);
  expect(owner.status()).toBe(200);
  expect(owner.headers()["cache-control"]).toBe("private, max-age=31536000, immutable");
  expect(owner.headers()["x-content-type-options"]).toBe("nosniff");
  const ownerSvg = await owner.text();
  expect(ownerSvg).toContain('<symbol id="t"');

  // another key: the current drawing, not cached
  const other = await page.request.get(href.replace(/v=[\w-]+/, "v=AAAAAAAAAAAAAAAA"));
  expect(other.status()).toBe(200);
  expect(other.headers()["cache-control"]).toBe("private, no-store");
  expect(await other.text()).toBe(ownerSvg);

  // a canvas outside this workspace, or none: 404
  expect((await page.request.get(path(RETAIL, SEED_IDS.canvasBankFirst))).status()).toBe(404);
  expect((await page.request.get(path(RETAIL, "01900000-0000-7000-8000-0000000000ff"))).status()).toBe(404);

  // a reader and a reviewer get the owner's drawing
  for (const name of ["Kasia Zielińska", "Piotr Wiśniewski"] as const) {
    const context = await browser.newContext();
    const p = await context.newPage();
    await signInAs(p, name);
    const r = await p.request.get(href);
    expect(r.status(), name).toBe(200);
    expect(await r.text(), name).toBe(ownerSvg);
    await context.close();
  }

  // not a member of the workspace (Piotr is not in Bank X): 404
  {
    const context = await browser.newContext();
    const p = await context.newPage();
    await signInAs(p, "Piotr Wiśniewski");
    expect((await p.request.get(path(SEED_IDS.wsBankX, SEED_IDS.canvasBankFirst))).status()).toBe(404);
    await context.close();
  }

  // a member whose organization is not unlocked in this session: 403 (Łukasz signed in to InfoMate only; Sales
  // analytics is Retail Co's)
  {
    const context = await browser.newContext();
    const p = await context.newPage();
    await signInWithPassword(p, "lukasz@infomate.pl", "InfoMate");
    expect((await p.request.get(path(SEED_IDS.wsSales, SEED_IDS.canvasSalesFirst))).status()).toBe(403);
    expect((await p.request.get(href)).status()).toBe(200);
    await context.close();
  }

  // no session: 401
  const anonymous = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
  const unsigned = await anonymous.get(href, { maxRedirects: 0 });
  expect(unsigned.status()).toBe(401);
  // nor does a signed-in answer set a cookie (the preferences are for pages)
  expect(owner.headers()["set-cookie"]).toBeUndefined();
  await anonymous.dispose();

  // a deleted canvas: 404 (Order lines & products is only in Order management, so its delete deletes it)
  const s = store();
  const [canvas, project, canvasLinks, projectLinks, items, frames, notes] = await Promise.all([
    s.canvases.get(RETAIL, OL),
    s.projects.get(RETAIL, OM),
    s.canvases.listLinksOfCanvas(RETAIL, OL),
    s.canvases.listLinksOfProject(RETAIL, OM),
    s.canvasItems.listOfCanvas(RETAIL, OL),
    s.frames.listOfCanvas(RETAIL, OL),
    s.notes.listOfCanvas(RETAIL, OL),
  ]);
  const r = await asLukasz((ctx, access) => deleteCanvas(ctx, access, { canvas, project, canvasLinks, projectLinks, items, frames, notes }, { projectId: OM, canvasId: OL, expectedVersion: canvas!.version }));
  expect(r.deleted).toBe(true);
  expect((await page.request.get(href)).status()).toBe(404);
});
