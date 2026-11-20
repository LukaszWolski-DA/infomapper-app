// What the measuring specs measure and as whom (slice 31, Q9): the demo by default, or, with MEASURE_WORKSPACE, the
// workspace of that id ("own mode"), so a measurement of Łukasz's own model never names it in the repository.
//
// - MEASURE_WORKSPACE: a workspace's id. Its largest canvas (most live cards, in a live project) and its first shared
//   document are found in the database (`INFOMAPPER_DATABASE_URL`).
// - MEASURE_EMAIL_VAR and MEASURE_PASSWORD_VAR: the NAMES of the variables (in `.env.postgres.local` or the environment)
//   that hold the account to sign in with; required in own mode. By default the demo's Łukasz and
//   INFOMAPPER_DEMO_PASSWORD.
// - Own mode records nothing but the numbers: `playwright.pg.config.ts` turns traces, screenshots, videos and the HTML
//   report off; the specs print labels ("the workspace"), never a name; the raw files go to `.data/measure/s31/`
//   (git-ignored). CI never runs a measuring spec (MEASURE=1 only), and the repository is public: never upload these files.
import { expect, type Page } from "@playwright/test";
import { demoPassword, PEOPLE, query } from "./helpers";

export const OWN_WORKSPACE = process.env.MEASURE_WORKSPACE || null;
export const OWN_MODE = !!OWN_WORKSPACE;

/** The account to sign in with: the demo's Łukasz, or the variables MEASURE_EMAIL_VAR and MEASURE_PASSWORD_VAR name. */
export function measureAccount(): { email: string; password: string } {
  const emailVar = process.env.MEASURE_EMAIL_VAR;
  const passwordVar = process.env.MEASURE_PASSWORD_VAR;
  if (OWN_MODE && (!emailVar || !passwordVar)) throw new Error("MEASURE_WORKSPACE needs MEASURE_EMAIL_VAR and MEASURE_PASSWORD_VAR (the names of the variables holding the account).");
  if (!emailVar || !passwordVar) return { email: PEOPLE.lukasz, password: demoPassword() };
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) throw new Error("The variables MEASURE_EMAIL_VAR and MEASURE_PASSWORD_VAR name are not set.");
  return { email: email.trim().toLowerCase(), password };
}

/** Signs in with the measuring account through the account form (Postgres). */
export async function signInToMeasure(page: Page): Promise<void> {
  const { email, password } = measureAccount();
  await page.goto("/sign-in");
  await page.getByTestId("input-sign-in-email").fill(email);
  await page.getByTestId("input-sign-in-password").fill(password);
  await page.getByTestId("button-sign-in").click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** The measuring account's person id in the database. */
export async function measureUserId(): Promise<string> {
  const [u] = await query<{ id: string }>("select id from app_user where lower(email) = $1", [measureAccount().email]);
  if (!u) throw new Error("The measuring account has no person in the database.");
  return u.id;
}

export interface Target {
  workspaceId: string;
  projectId: string;
  canvasId: string;
  documentId: string | null;
}

/** A workspace's largest canvas in a live project, and its first shared document. */
export async function largestCanvas(workspaceId: string): Promise<Target> {
  const [c] = await query<{ project_id: string; canvas_id: string }>(
    `select l.project_id, l.canvas_id from project_canvas l
       join project p on p.id = l.project_id and p.deleted_at is null
       join canvas c on c.id = l.canvas_id and c.deleted_at is null
       left join canvas_item i on i.canvas_id = c.id and i.deleted_at is null
      where l.workspace_id = $1
      group by l.project_id, l.canvas_id, p.created_at, p.id, l.sort_order, l.added_at
      order by count(i.id) desc, p.created_at, p.id, l.sort_order, l.added_at limit 1`,
    [workspaceId],
  );
  if (!c) throw new Error("The workspace has no canvas in a live project.");
  const [doc] = await query<{ id: string }>("select id from document_definition where workspace_id = $1 and deleted_at is null and shared order by created_at, id limit 1", [workspaceId]);
  return { workspaceId, projectId: c.project_id, canvasId: c.canvas_id, documentId: doc?.id ?? null };
}

/**
 * The top of the measuring account's undo list in the workspace (0 when empty). A spec reads it before its first write
 * and undoes until the top is back there (a position, not a time: the steps carry the app server's clock).
 */
export async function undoTop(workspaceId: string, userId: string): Promise<number> {
  const [r] = await query<{ n: number }>(
    "select coalesce(max(position), 0)::int as n from undo_step where workspace_id = $1 and user_id = $2 and list = 'undo'",
    [workspaceId, userId],
  );
  return r!.n;
}
