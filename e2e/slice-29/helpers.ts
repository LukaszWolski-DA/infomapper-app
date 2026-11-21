// Slice 29's smoke helpers (playwright.pg.config.ts): signing in with Supabase Auth on Postgres, and the demo's ids read
// from the Postgres database the app runs on (the loader gives the demo fresh ids each time it runs). The demo password
// comes from INFOMAPPER_DEMO_PASSWORD and is never printed or attached to a report.
import { expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { pgClientConfig } from "../../src/data/postgres/config";
import { landed } from "../session-full-load";

export const PEOPLE = {
  lukasz: "lukasz@infomate.pl",
  anna: "anna.nowak@infomate.pl",
  kasia: "k.zielinska@retailco.com",
  marek: "m.lis@retailco.com",
} as const;

export const demoPassword = (): string => {
  const p = process.env.INFOMAPPER_DEMO_PASSWORD;
  if (!p) throw new Error("INFOMAPPER_DEMO_PASSWORD is not set.");
  return p;
};

/** One query against the app's database (INFOMAPPER_DATABASE_URL), for ids only. */
export async function query<R extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> {
  const url = process.env.INFOMAPPER_DATABASE_URL;
  if (!url) throw new Error("INFOMAPPER_DATABASE_URL is not set.");
  const client = new Client(pgClientConfig(url));
  await client.connect();
  try {
    return (await client.query<R>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

/** A live workspace's id by its name. */
export async function workspaceId(name: string): Promise<string> {
  const [row] = await query<{ id: string }>("select id from workspace where name = $1 and deleted_at is null", [name]);
  if (!row) throw new Error(`No workspace named ${name}.`);
  return row.id;
}

/** A project of a workspace with its first canvas in tab order. */
export async function firstCanvas(workspace: string): Promise<{ projectId: string; canvasId: string; canvasName: string }> {
  const ws = await workspaceId(workspace);
  const [row] = await query<{ project_id: string; canvas_id: string; name: string }>(
    `select l.project_id, l.canvas_id, c.name from project_canvas l
       join project p on p.id = l.project_id and p.deleted_at is null
       join canvas c on c.id = l.canvas_id and c.deleted_at is null
      where l.workspace_id = $1 order by p.created_at, p.id, l.sort_order, l.added_at limit 1`,
    [ws],
  );
  if (!row) throw new Error(`${workspace} has no canvas.`);
  return { projectId: row.project_id, canvasId: row.canvas_id, canvasName: row.name };
}

/** Fills the account form and signs in; `password` defaults to the demo password. */
export async function fillSignIn(page: Page, email: string, password: string = demoPassword()) {
  await page.goto("/sign-in");
  await expect(page.getByTestId("panel-account-sign-in")).toBeVisible();
  await page.getByTestId("input-sign-in-email").fill(email);
  await page.getByTestId("input-sign-in-password").fill(password);
  await page.getByTestId("button-sign-in").click();
}

/** Signs in and waits until the app has left the start page. */
export async function signIn(page: Page, email: string) {
  await fillSignIn(page, email);
  await expect(page).not.toHaveURL(/\/sign-in/);
  await landed(page);
}
