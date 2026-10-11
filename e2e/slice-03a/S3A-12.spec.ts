import { expect, test } from "./fixtures";
import { card, ids, key, labelNamed, loadLinks, openCanvas, rawDb, signInAs, canvasUrl, WHOLE_CO } from "./helpers";

test("S3A-12: deleting Customer soft-deletes its label links and those of its attributes and mappings in the same change group; Ctrl+Z restores them", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer");
  const cr23 = (await labelNamed("CR-23"))!;
  // CR-23 marks Customer, email, segment_code and the mapping web_users.email → Customer.email
  const links = (await loadLinks()).filter((k) => k.label_id === cr23.id);
  expect(links).toHaveLength(4);
  const linkIds = links.map((k) => k.id).sort();

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("button-delete-entity").click();
  await page.getByTestId("button-confirm-delete-entity").click();
  await expect.poll(async () => (await rawDb()).entity.find((e) => e.id === customer.id)!.deleted_at).not.toBeNull();

  // every link is soft-deleted, in the entity's change group; the label stays
  const db = await rawDb();
  expect(db.label_link.filter((k) => linkIds.includes(k.id)).every((k) => k.deleted_at !== null)).toBe(true);
  const group = db.change_event.find((e) => e.object_type === "entity" && e.object_id === customer.id && e.operation === "delete")!.change_group_id;
  const linkEvents = db.change_event.filter((e) => e.object_type === "label_link" && linkIds.includes(e.object_id));
  expect(linkEvents.map((e) => e.change_group_id)).toEqual(linkIds.map(() => group));
  expect((await labelNamed("CR-23"))?.id).toBe(cr23.id);
  expect((await loadLinks()).filter((k) => k.label_id === cr23.id)).toHaveLength(0);

  // one undo step brings the entity and all four links back
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await key(page, "Control+z");
  await expect.poll(async () => (await loadLinks()).filter((k) => k.label_id === cr23.id).map((k) => k.id).sort()).toEqual(linkIds);
  expect((await rawDb()).entity.find((e) => e.id === customer.id)!.deleted_at).toBeNull();
});
