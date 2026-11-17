// S29-03 (slice 29): every write on Postgres is refused with the read-only error. The document editor is the one page
// that still offers changes on a read-only server (a known limitation of slice A, accepted by Łukasz): a section's
// switch saves at once, and the server refuses it with READ_ONLY_SERVER_MESSAGE; the stored document is unchanged.
import { expect, test } from "@playwright/test";
import { READ_ONLY_SERVER_MESSAGE } from "../../src/domain/errors";
import { PEOPLE, query, signIn, workspaceId } from "./helpers";

test("a write is refused with the read-only error and changes nothing", async ({ page }) => {
  await signIn(page, PEOPLE.lukasz);
  const ws = await workspaceId("Retail Co – DWH");
  const [doc] = await query<{ id: string; version: number }>(
    "select d.id, d.version from document_definition d join app_user u on u.id = d.author_id where d.workspace_id = $1 and d.deleted_at is null and u.email = $2 order by d.created_at, d.id limit 1",
    [ws, PEOPLE.lukasz],
  );
  await page.goto(`/w/${ws}/d/${doc!.id}`);
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  await page.getByTestId("check-section-on").first().click();
  await expect(page.getByTestId("toast").filter({ hasText: READ_ONLY_SERVER_MESSAGE })).toBeVisible();
  const [after] = await query<{ version: number }>("select version from document_definition where id = $1", [doc!.id]);
  expect(after!.version).toBe(doc!.version);
});
