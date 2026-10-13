import { expect, test } from "./fixtures";
import { card, expectCard, expectToast, ids, linkedTo, liveCards, liveUrl, openCanvas, openLiveFor, signInAs, toolboxAt, undo } from "./helpers";

test("S3B-11: removing a directly labeled card that also has labeled rows asks the first question and keeps it as context; removing a context card asks the second and unlabels its rows and mappings; each is one undo step", async ({ page }) => {
  test.setTimeout(150_000);
  const { entity, table } = await ids();
  const live = await openLiveFor("CR-23");
  const customer = entity("Customer").id, webUsers = table("web_users").id;
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 0.7 });

  // Customer (CR-23 on it, on two of its attributes and on a mapping into it): the toolbox's “Remove from this canvas
  // (unlabel)…” asks the first question; the label comes off Customer, the card stays as context
  const head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  await toolboxAt(page, { x: head.x + 20, y: head.y + 10 });
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: /Remove from this canvas \(unlabel\)…/ }).click();
  await expect(page.getByTestId("text-live-question")).toHaveText("Take the label CR-23 off Customer? It stays here as context, because 2 attributes and 1 mapping of it carry CR-23.");
  await expect(page.getByTestId("button-live-yes")).toHaveText("Remove CR-23");
  await page.getByTestId("button-live-yes").click();
  await expectToast(page, "Customer is no longer labeled CR-23.");
  await expect.poll(() => linkedTo("CR-23")).not.toContain(customer);
  await expect.poll(() => liveCards(live)).toContainEqual([customer, "context", "labeled"]);
  await expectCard(page, "Customer");
  // one undo step
  await undo(page);
  await expect.poll(() => liveCards(live)).toContainEqual([customer, "full", "all"]);
  expect(await linkedTo("CR-23")).toContain(customer);

  // web_users, here as context through one mapping: Delete asks the second question; the mapping's label comes off and
  // the card leaves
  const before = await linkedTo("CR-23");
  await card(page, "web_users").getByTestId("card-name").click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("text-live-question")).toHaveText("web_users is here because 1 mapping carries CR-23. Take the label off it?");
  await expect(page.getByTestId("button-live-yes")).toHaveText("Remove from 1 mapping");
  await page.getByTestId("button-live-yes").click();
  await expectToast(page, "Label CR-23 removed from 1 mapping of web_users.");
  await expect.poll(async () => (await liveCards(live)).some(([id]) => id === webUsers)).toBe(false);
  expect((await linkedTo("CR-23")).length).toBe(before.length - 1);
  await expectCard(page, "web_users", 0);
  // one undo step
  await undo(page);
  await expect.poll(() => liveCards(live)).toContainEqual([webUsers, "context", "labeled"]);
  expect(await linkedTo("CR-23")).toEqual(expect.arrayContaining(before));
});
