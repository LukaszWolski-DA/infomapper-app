// Slice 30's smoke writes on Postgres (S30-01, S30-02, S30-08, S30-09): sign in, rename an entity and add an attribute
// in its panel, reload and see them stored, then Undo from a new session; the badge says "Online", the pages are not
// read only, and (since slice 33) "Invite person" stands where the disabled "Add person" stood.
//
// F13: these specs write, so they run only against a database on this machine (CI's Supabase local stack, the Schema
// workflow's smoke job); against `npm run dev:pg` or the preview, both on infomapper-dev, they are skipped. Each run of
// the job starts from a fresh load, so the rows they write need no reseed: the read specs beside them count projects,
// canvases and cards, which these writes leave as they were.
import { expect, test, type Page } from "@playwright/test";
import { firstCanvas, PEOPLE, query, signIn, workspaceId } from "./helpers";

const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
const writesHere = (() => {
  const url = process.env.INFOMAPPER_DATABASE_URL;
  return !!url && LOCAL.includes(new URL(url).hostname);
})();

test.skip(!writesHere, "Writes only against a database on this machine (F13), never infomapper-dev.");

const WS = "Retail Co – DWH";
const RENAMED = `Product (smoke ${Date.now()})`;

async function openProduct(page: Page) {
  const { projectId, canvasId } = await firstCanvas(WS);
  await page.goto(`/w/${await workspaceId(WS)}/p/${projectId}/c/${canvasId}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByTestId("tab-model").click();
}

const entityRow = async (name: string) =>
  (await query<{ id: string; name: string; version: number }>("select id, name, version from entity where workspace_id = $1 and name = $2 and deleted_at is null", [await workspaceId(WS), name]))[0];

test("S30-01, S30-09: a rename and a new attribute are saved online and stay after a reload; the badge says Online", async ({ page }) => {
  await signIn(page, PEOPLE.lukasz);
  await openProduct(page);
  await expect(page.getByTestId("badge-server")).toHaveText(/^Online/, { useInnerText: true });
  await page.getByTestId("tree-item").filter({ has: page.getByText("Product", { exact: true }) }).click();
  const panel = page.getByTestId("panel-entity");
  await expect(panel).toBeVisible();
  const before = (await query<{ n: number }>("select count(*)::int as n from attribute a join entity e on e.id = a.entity_id where e.workspace_id = $1 and e.name = 'Product' and a.deleted_at is null", [await workspaceId(WS)]))[0]!.n;

  await panel.getByTestId("button-add-attribute").click();
  await expect(page.getByTestId("indicator-save")).toHaveAttribute("data-state", /saved|fading|idle/, { timeout: 15_000 });
  const name = page.getByTestId("panel-entity").getByTestId("input-entity-name");
  await page.getByTestId("tree-item").filter({ has: page.getByText("Product", { exact: true }) }).click();
  await name.fill(RENAMED);
  await name.press("Enter");
  await expect.poll(async () => (await entityRow(RENAMED))?.name, { timeout: 15_000 }).toBe(RENAMED);
  const after = (await query<{ n: number }>("select count(*)::int as n from attribute a join entity e on e.id = a.entity_id where e.workspace_id = $1 and e.name = $2 and a.deleted_at is null", [await workspaceId(WS), RENAMED]))[0]!.n;
  expect(after).toBe(before + 1);

  await page.reload();
  await page.getByTestId("tab-model").click();
  await expect(page.getByTestId("tree-item").filter({ has: page.getByText(RENAMED, { exact: true }) })).toBeVisible();
  // the change events in the same transaction (AD-13)
  const row = (await entityRow(RENAMED))!;
  const events = await query<{ n: number }>("select count(*)::int as n from change_event where object_id = $1 and operation = 'update'", [row.id]);
  expect(events[0]!.n).toBeGreaterThanOrEqual(1);
});

test("S30-02: Undo in a new session undoes the person's latest step, and Redo brings it back", async ({ browser }) => {
  const first = await browser.newPage();
  await signIn(first, PEOPLE.lukasz);
  await openProduct(first);
  await first.getByTestId("tree-item").filter({ has: first.getByText(RENAMED, { exact: true }) }).click();
  const again = `${RENAMED} again`;
  const name = first.getByTestId("panel-entity").getByTestId("input-entity-name");
  await name.fill(again);
  await name.press("Enter");
  await expect.poll(async () => (await entityRow(again))?.name, { timeout: 15_000 }).toBe(again);
  await first.close();

  // a new browser context: a new session, nothing of the first in memory
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, PEOPLE.lukasz);
  await openProduct(page);
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await entityRow(RENAMED))?.name, { timeout: 15_000 }).toBe(RENAMED);
  await expect(page.getByTestId("button-redo")).toBeEnabled();
  await page.getByTestId("button-redo").click();
  await expect.poll(async () => (await entityRow(again))?.name, { timeout: 15_000 }).toBe(again);
  await context.close();
});

test("S30-08 (since slice 33): online, Invite person replaced the disabled Add person; changing roles stays", async ({ page }) => {
  await signIn(page, PEOPLE.lukasz);
  await page.goto(`/w/${await workspaceId(WS)}?tab=people`);
  await expect(page.getByTestId("box-add-person")).toHaveCount(0);
  const box = page.getByTestId("box-invite-person");
  await expect(box).toBeVisible();
  // CI's stack gives the server its secret key, so invitations work (D10's line only without it)
  await expect(box.getByTestId("button-create-invitation")).toBeEnabled();
  await expect(box.getByTestId("text-invite-not-ready")).toHaveCount(0);
  await expect(page.getByTestId("select-person-role").first()).toBeEnabled();
});
