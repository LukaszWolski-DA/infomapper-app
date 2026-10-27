import type { Page } from "@playwright/test";
import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { expectToast } from "./helpers";

const GOOD = { organizationName: "Test Org", name: "Jan Test", email: "jan@example.com", password: "correct horse", passwordAgain: "correct horse" };
const fill = async (page: Page, values: Record<string, string>) => {
  for (const [key, value] of Object.entries(values)) await page.getByTestId(`input-create-${key}`).fill(value);
};

test("S8-02: creating an organization: the checks, the summary, Back, then Create writes it all in one change group and signs in", async ({ page }) => {
  await page.goto("/sign-in");
  const form = page.getByTestId("panel-create-organization");
  await expect(page.getByTestId("input-create-workspaceName")).toHaveValue("First workspace");

  const problem = async (values: Record<string, string>, message: string) => {
    await fill(page, { ...GOOD, ...values });
    await form.getByTestId("button-create-continue").click();
    await expect(form.getByTestId("message-field").or(form.getByTestId("message-start")).first()).toHaveText(message);
  };
  await problem({ organizationName: " " }, "Enter the organization's name.");
  await problem({ email: "jan@example" }, "Enter a valid e-mail address.");
  await problem({ password: "short", passwordAgain: "short" }, "The password needs at least 8 characters.");
  await problem({ passwordAgain: "correct horsE" }, "The passwords differ.");

  await fill(page, GOOD);
  await form.getByTestId("button-create-continue").click();
  await expect(form.getByTestId("text-create-summary")).toHaveText(
    "You are creating the organization Test Org with you (Jan Test, jan@example.com) as its owner, and the workspace First workspace with an empty first project and canvas, and the 19 built-in classifications. People sign in to Test Org with its link and this password.",
  );
  const before = await readDb(E2E_DB);
  await form.getByTestId("button-create-back").click();
  await expect(page.getByTestId("input-create-organizationName")).toHaveValue("Test Org");
  await expect(page.getByTestId("input-create-password")).toHaveValue("correct horse");
  expect((await readDb(E2E_DB)).organization).toHaveLength(before.organization.length);

  await form.getByTestId("button-create-continue").click();
  await form.getByTestId("button-create").click();
  await expectToast(page, "Created Test Org with an empty first workspace.");
  await expect(page.getByTestId("page-workspace-home")).toContainText("First workspace");

  const db = await readDb(E2E_DB);
  const user = db.app_user.find((u) => u.email === "jan@example.com")!;
  const org = db.organization.find((o) => o.name === "Test Org")!;
  const ws = db.workspace.find((w) => w.organization_id === org.id)!;
  expect(user.display_name).toBe("Jan Test");
  expect(db.organization_access.find((a) => a.organization_id === org.id)?.access_hash).toMatch(/^scrypt\$15\$8\$1\$/);
  expect(db.organization_member).toContainEqual(expect.objectContaining({ organization_id: org.id, user_id: user.id, role: "owner" }));
  expect(db.workspace_member).toContainEqual(expect.objectContaining({ workspace_id: ws.id, user_id: user.id, role: "owner" }));
  expect(db.classification.filter((c) => c.workspace_id === ws.id)).toHaveLength(19);
  const events = db.change_event.filter((e) => e.workspace_id === ws.id);
  expect(new Set(events.map((e) => e.change_group_id)).size).toBe(1);
  expect(events.map((e) => e.object_type)).toEqual(
    expect.arrayContaining(["app_user", "organization", "organization_access", "organization_member", "workspace", "project", "canvas"]),
  );
  expect(events.every((e) => e.user_id === user.id)).toBe(true);
});
