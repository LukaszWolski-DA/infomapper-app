// S29-06 (slice 29): the smoke on Postgres. The workspace home, a project home, a canvas page and a document's page open
// and draw from Postgres. Slice 30: the server takes writes, so the pages are no longer read only (S30-08): the role
// shows, and what the role allows is offered. These specs only read (F13: they also run against the preview).
import { expect, test } from "@playwright/test";
import { firstCanvas, PEOPLE, query, signIn, workspaceId } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, PEOPLE.lukasz);
});

test("the workspace home draws its projects, and offers what the role allows", async ({ page }) => {
  const ws = await workspaceId("Retail Co – DWH");
  await page.goto(`/w/${ws}`);
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();
  await expect(page.getByTestId("banner-read-only")).toHaveCount(0);
  await expect(page.getByTestId("indicator-user-role")).not.toHaveText("Read only");
  await expect(page.getByTestId("indicator-user")).toHaveAttribute("data-standing", "full");
  const projects = await query<{ n: number }>("select count(*) as n from project where workspace_id = $1 and deleted_at is null", [ws]);
  await expect(page.getByTestId("tile-project")).toHaveCount(Number(projects[0]!.n));
  await expect(page.getByTestId("tile-new-project")).toHaveCount(1);
});

test("a project home draws its canvases' tiles with their thumbnails", async ({ page }) => {
  const { projectId } = await firstCanvas("Retail Co – DWH");
  const ws = await workspaceId("Retail Co – DWH");
  await page.goto(`/w/${ws}/p/${projectId}`);
  await expect(page.getByTestId("page-project-home")).toBeVisible();
  const canvases = await query<{ n: number }>(
    "select count(*) as n from project_canvas l join canvas c on c.id = l.canvas_id and c.deleted_at is null where l.project_id = $1",
    [projectId],
  );
  await expect(page.getByTestId("tile-canvas")).toHaveCount(Number(canvases[0]!.n));
  // the thumbnail's drawing is a resource of its own (AD-32): it answers, and carries no cookie (F9)
  const href = await page.getByTestId("tile-thumbnail").first().locator("use").getAttribute("href");
  const answer = await page.request.get(href!.split("#")[0]!);
  expect(answer.status()).toBe(200);
  expect(answer.headers()["set-cookie"]).toBeUndefined();
});

test("a canvas page draws its cards from Postgres", async ({ page }) => {
  const { projectId, canvasId } = await firstCanvas("Retail Co – DWH");
  const ws = await workspaceId("Retail Co – DWH");
  await page.goto(`/w/${ws}/p/${projectId}/c/${canvasId}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const [entity] = await query<{ name: string }>(
    `select e.name from canvas_item i join entity e on e.id = i.entity_id and e.deleted_at is null
      where i.canvas_id = $1 and i.deleted_at is null order by e.name limit 1`,
    [canvasId],
  );
  await expect(page.getByTestId("card-name").filter({ hasText: entity!.name }).first()).toBeAttached();
  await expect(page.getByTestId("indicator-user-role")).not.toHaveText("Read only");
});

test("a document's page is laid out from Postgres", async ({ page }) => {
  const ws = await workspaceId("Retail Co – DWH");
  const [doc] = await query<{ id: string }>(
    "select id from document_definition where workspace_id = $1 and deleted_at is null and shared order by created_at, id limit 1",
    [ws],
  );
  await page.goto(`/w/${ws}/d/${doc!.id}/view`);
  await expect(page.getByTestId("page-document-view")).toBeVisible();
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", "done", { timeout: 30_000 });
  await expect(page.locator('[data-testid="document-host"] .pagedjs_page').first()).toBeVisible();
});
