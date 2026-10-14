import { expect, test, type Page } from "./fixtures";
import {
  canvasUrl,
  contextOn,
  ids,
  labelNamed,
  lastGroup,
  linkedTo,
  mappingId,
  openCanvas,
  openEntityFromTree,
  openRequirementsTab,
  pickOption,
  RETAIL,
  row,
  SEED_IDS,
  signInAs,
  store,
} from "./helpers";

const home = (projectId: string) => `/w/${RETAIL}/p/${projectId}`;
const homeRows = (page: Page) => page.getByTestId("item-project-requirement").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.key} ${(e as HTMLElement).querySelector("[data-testid=text-project-requirement-coverage]")!.textContent}`));

test("S4A-13: the workspace Overview's “{covered} of {total} requirements covered”, the project home's statistic and Requirements of “Customer 360” and “Order management”; a click opens the last opened canvas (else the first) with the requirement's panel; the status bar's “Requirements 5, covered m” and the Overview update after an approval; with the context on, creating and linking a requirement labels nothing and records the context", async ({ page }) => {
  const expected = ["REQ-101 5/8, Agreed", "REQ-102 3/3, Agreed", "REQ-104 1/4, Draft", "REQ-103 1/1, Draft", "REQ-105 3/4, Agreed"];
  await signInAs(page, "Łukasz");
  // the workspace Overview: the whole workspace's requirements, as the status bar
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("stat-workspace-requirements")).toHaveText("2 of 5 requirements covered");
  for (const project of [SEED_IDS.projCustomer360, SEED_IDS.projOrderManagement]) {
    await page.goto(home(project));
    await expect(page.getByTestId("stat-requirements")).toHaveText("5 requirements, 2 covered");
    await expect.poll(() => homeRows(page)).toEqual(expected);
  }

  // no canvas opened yet in Order management: the first one (Customer & orders) opens, with REQ-104's panel
  await page.getByTestId("item-project-requirement").filter({ hasText: "REQ-104" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-104");
  // after “Order lines & products”, that one opens
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement));
  await page.goto(home(SEED_IDS.projOrderManagement));
  await page.getByTestId("item-project-requirement").filter({ hasText: "REQ-103" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${SEED_IDS.canvasOrderLines}$`));
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-103");

  // the status bar, before and after birth_date's mapping is approved (REQ-105 becomes covered)
  const { attribute } = await ids();
  await openCanvas(page);
  await expect(page.getByTestId("status-requirements")).toHaveText("Requirements 5, covered 2");
  await row(page, "Customer", attribute("Customer", "birth_date").id).click();
  await page.getByTestId("list-attribute-mappings").getByText("customers.dob").click();
  await page.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved", exact: true }).click();
  const dob = await mappingId("customers.dob", "Customer.birth_date");
  await expect.poll(async () => (await store().model.load(RETAIL)).mappings.find((m) => m.id === dob)?.status).toBe("approved");
  await expect(page.getByTestId("status-requirements")).toHaveText("Requirements 5, covered 3");
  await page.goto(`/w/${RETAIL}`);
  await expect(page.getByTestId("stat-workspace-requirements")).toHaveText("3 of 5 requirements covered");

  // the working context: requirement and link writes record it and label nothing
  const cr23 = (await labelNamed("CR-23"))!;
  const marked = await linkedTo("CR-23");
  await contextOn(page, "CR-23");
  await openCanvas(page);
  await openRequirementsTab(page);
  await page.getByTestId("button-new-requirement").click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-106");
  let group = await lastGroup();
  expect(group.map((e) => e.object_type).sort()).toEqual(["requirement", "workspace"]);
  expect(group.every((e) => e.context_label_id === cr23.id)).toBe(true);
  await openEntityFromTree(page, "Order Line");
  await pickOption(page.getByTestId("select-link-requirement"), "REQ-106");
  await expect.poll(async () => (await lastGroup()).map((e) => e.object_type)).toEqual(["requirement_link"]);
  group = await lastGroup();
  expect(group[0]!.context_label_id).toBe(cr23.id);
  expect(await linkedTo("CR-23")).toEqual(marked);
});
