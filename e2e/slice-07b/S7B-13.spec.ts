// S7B-13: model consistency on the project home (item 25; step 1 answers Q8, F15): each group with its severity and
// hint, scoped to the project, live after an action; each line opens its object on a canvas (`?map=`, `?row=`,
// `?system=`, `?req=`); the all-well text.

import type { Page } from "@playwright/test";
import { createProject } from "../../src/domain/commands/project";
import { CONSISTENCY_TEXT } from "../../src/domain/source-changes/consistency";
import { expect, test } from "./fixtures";
import { act, asPerson, crmChanges, RETAIL, SEED_IDS, signInAs, today } from "./helpers";

const HOME = `/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`;
const section = (page: Page) => page.getByTestId("section-consistency");
const group = (page: Page, id: string) => section(page).getByTestId("consistency-group").and(page.locator(`[data-group="${id}"]`));
const lines = (page: Page, id: string) => group(page, id).getByTestId("consistency-line");
const line = (page: Page, id: string, text: string) => lines(page, id).filter({ hasText: text });

test("S7B-13: each group with its severity, hint and lines after the re-imports; the badge; the systems line", async ({ page }) => {
  await crmChanges();
  await signInAs(page, "Łukasz");
  await page.goto(HOME);
  await expect(section(page).getByTestId("consistency-title")).toHaveText([
    CONSISTENCY_TEXT.gone,
    CONSISTENCY_TEXT.noSource,
    CONSISTENCY_TEXT.conflicts,
    CONSISTENCY_TEXT.review,
    CONSISTENCY_TEXT.requirements,
    CONSISTENCY_TEXT.systems,
  ]);
  await expect(group(page, "gone")).toHaveAttribute("data-severity", "normal");
  await expect(group(page, "gone").getByTestId("consistency-hint")).toHaveText(CONSISTENCY_TEXT.goneHint);
  await expect(lines(page, "gone")).toHaveText([`customers.created_ts → Customer.created_atIn review, missing since ${today()}`]);
  await expect(group(page, "no_source").getByTestId("consistency-hint")).toHaveText(CONSISTENCY_TEXT.noSourceHint);
  await expect(lines(page, "no_source")).toHaveText([`Customer.created_at${CONSISTENCY_TEXT.columnsLeft}`]);
  await expect(line(page, "conflicts", "customers.email_addr → Customer.email")).toContainText("In review: varchar(255) into string(120)");
  await expect(lines(page, "review")).toHaveText([
    "customers.cust_no → Customer.customer_numberbusiness key column changed type, varchar(20) → varchar(25)",
    "customers.email_addr → Customer.emailtype conflict, varchar(255) into string(120)",
  ]);
  await expect(lines(page, "requirements").first()).toContainText("covered");
  await expect(lines(page, "systems")).toHaveText([`CRM${CONSISTENCY_TEXT.toDecide(9)}`]);
  // the badge: every listed mapping and attribute plus the open changes
  const listed = (await lines(page, "gone").count()) + (await lines(page, "no_source").count()) + (await lines(page, "conflicts").count()) + (await lines(page, "review").count());
  await expect(section(page).getByTestId("consistency-badge")).toHaveText(String(listed + 9));
});

test("S7B-13: each line opens its object on a canvas; live after an action (approve, retire)", async ({ page }) => {
  await crmChanges();
  await signInAs(page, "Łukasz");
  await page.goto(HOME);

  // a mapping: its panel, the address loses the parameter; approving it makes its type conflict high
  await line(page, "conflicts", "customers.email_addr → Customer.email").click();
  await expect(page).toHaveURL(/\/c\/[^?]+$/);
  const panel = page.getByTestId("panel-mapping");
  await expect(panel).toBeVisible();
  await panel.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved" }).click();
  await expect(panel.getByTestId("seg-mapping-status").locator('[aria-pressed="true"]')).toHaveText("Approved");
  await page.getByTestId("tab-home").click();
  await expect(group(page, "conflicts")).toHaveAttribute("data-severity", "high");
  await expect(line(page, "review", "customers.email_addr")).toHaveCount(0);
  // approving in the panel settled its change (Q12)
  await expect(lines(page, "systems")).toHaveText([`CRM${CONSISTENCY_TEXT.toDecide(8)}`]);

  // an attribute without an active source: its row on the canvas
  await line(page, "no_source", "Customer.created_at").click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.getByTestId("panel-attribute")).toContainText("customers.created_ts");

  // a system: its panel; retiring the column that left changes the home
  await page.getByTestId("tab-home").click();
  await line(page, "systems", "CRM").click();
  await expect(page.getByTestId("panel-source-system")).toBeVisible();
  await act(page, "column_left", "dbo.customers.created_ts", "retire", "Retired: kept as historical: dbo.customers.created_ts");
  await page.getByTestId("tab-home").click();
  await expect(group(page, "gone")).toHaveCount(0);
  await expect(lines(page, "no_source")).toHaveText([`Customer.created_at${CONSISTENCY_TEXT.historicalOnly}`]);
  await expect(lines(page, "systems")).toHaveText([`CRM${CONSISTENCY_TEXT.toDecide(7)}`]);

  // a requirement: its panel, as the Requirements list opens it
  await lines(page, "requirements").first().click();
  await expect(page.getByTestId("panel-requirement")).toBeVisible();
});

test("S7B-13: scoped to the project; a project with nothing to look at says so", async ({ page }) => {
  // no imports yet: an empty project has nothing in scope and no system has changes
  const { projectId } = await asPerson(SEED_IDS.userLukasz, (ctx, access) => createProject(ctx, access, { workspaceId: RETAIL, name: "Empty" }));
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}/p/${projectId}`);
  await expect(section(page).getByTestId("text-consistency-ok")).toHaveText(CONSISTENCY_TEXT.allWell);
  await expect(section(page).getByTestId("consistency-badge")).toHaveCount(0);

  // after the re-imports: the empty project lists only the system's changes (systems are not in projects)
  await crmChanges();
  await page.reload();
  await expect(section(page).getByTestId("consistency-group")).toHaveCount(1);
  await expect(lines(page, "systems")).toHaveText([`CRM${CONSISTENCY_TEXT.toDecide(9)}`]);
  await expect(section(page).getByTestId("consistency-badge")).toHaveText("9");
});

test("S7B-13: a reader sees model consistency and opens its lines", async ({ page }) => {
  await crmChanges();
  await signInAs(page, "Kasia Zielińska");
  await page.goto(HOME);
  await expect(group(page, "review")).toBeVisible();
  await line(page, "review", "customers.cust_no").click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
});
