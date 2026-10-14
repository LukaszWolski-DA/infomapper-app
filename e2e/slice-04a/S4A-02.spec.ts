import { expect, test } from "./fixtures";
import { expectToast, loadRequirements, openCanvas, openRequirementsTab, requirementByKey, signInAs, store, RETAIL } from "./helpers";

test("S4A-02: “New requirement” makes REQ-106 (Data requirement, Draft, Should, name selected), then REQ-107; one undo removes it; a typed REQ-108 makes the next REQ-109; a duplicate key and an empty name are refused and the fields go back", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirementsTab(page);

  await page.getByTestId("button-new-requirement").click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-106");
  await expect(page.getByTestId("select-req-kind")).toHaveValue("data");
  await expect(page.getByTestId("seg-req-status").locator("[aria-pressed=true]")).toHaveText("Draft");
  await expect(page.getByTestId("seg-req-priority").locator("[aria-pressed=true]")).toHaveText("Should");
  const name = page.getByTestId("input-req-name");
  await expect(name).toHaveValue("New requirement");
  await expect(name).toBeFocused();
  expect(await name.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, "New requirement".length]);
  expect(await requirementByKey("REQ-106")).toMatchObject({ kind: "data", status: "draft", priority: "should", name: "New requirement" });

  await page.getByTestId("button-new-requirement").click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-107");
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await loadRequirements()).map((r) => r.key).sort()).toEqual(["REQ-101", "REQ-102", "REQ-103", "REQ-104", "REQ-105", "REQ-106"]);

  // a key typed as REQ-108 makes the generated one skip to REQ-109 (the counter is at 108: REQ-107 was undone)
  await page.getByTestId("tree-req").filter({ hasText: "REQ-106" }).click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-106");
  await page.getByTestId("input-req-key").fill("REQ-108");
  await page.getByTestId("input-req-key").press("Enter");
  await expect.poll(async () => (await loadRequirements()).some((r) => r.key === "REQ-108")).toBe(true);
  await page.getByTestId("button-new-requirement").click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-109");
  expect((await store().workspaces.get(RETAIL))!.requirement_key_next).toBe(110);

  // a duplicate key (in any case) and an empty name: refused with their messages, the fields show the stored values
  await page.getByTestId("input-req-key").fill("req-101");
  await page.getByTestId("input-req-key").press("Enter");
  await expectToast(page, "req-101 is already used by another requirement.");
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-109");
  await page.getByTestId("input-req-name").fill("   ");
  await page.getByTestId("input-req-name").press("Enter");
  await expectToast(page, "Enter a name.");
  await expect(page.getByTestId("input-req-name")).toHaveValue("New requirement");
  expect(await requirementByKey("REQ-109")).toMatchObject({ key: "REQ-109", name: "New requirement" });
});
