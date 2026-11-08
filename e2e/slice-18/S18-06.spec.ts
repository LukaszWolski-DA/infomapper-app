// S18-06 (slice 18, item 4, F13): the demo's Dim Customer.country_name is a Lookup through Country → Customer Address
// with "Unknown"; switching to Direct copy and back keeps both; a new lookup on an input whose entity has one
// relationship selects it; two inputs refuse Lookup; the line's chip is "L". An approved lookup goes back to review
// when its relationship or its value for no match changes, not when its note does.

import { addCubeMappingInput } from "../../src/modules/infocube/domain/mappings";
import { expect, test, type Page } from "./fixtures";
import {
  asPersonOnCube,
  cubeLine,
  cubeMappingId,
  cubeMappingRow,
  expectCubePanelAt,
  expectToast,
  mappingModel,
  openCubeMapping,
  openStar,
  RETAIL,
  SEED_IDS,
  signInAs,
} from "./helpers";
import { seedId } from "../../src/data/local/seed-model";

const kindButton = (page: Page, label: string) => page.getByTestId("seg-cube-kind").getByRole("button", { name: label, exact: true });
const statusButton = (page: Page, label: string) => page.getByTestId("seg-cube-status").getByRole("button", { name: label, exact: true });

test("S18-06: the demo's lookup, its fields kept across kinds, the chip L; one relationship chosen for you; two inputs refuse it", async ({ page }) => {
  const country = cubeMappingId("cust.country_name");
  const locates = seedId(RETAIL, "relationship:country>address");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await expect(cubeLine(page, country).getByTestId("node-f")).toHaveText("L");
  const panel = await openCubeMapping(page, country);
  await expect(kindButton(page, "Lookup")).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByTestId("select-cube-lookup-via")).toHaveValue(locates);
  await expect(panel.getByTestId("select-cube-lookup-via").locator("option:checked")).toHaveText("Country → Customer Address (locates)");
  await expect(panel.getByTestId("input-cube-lookup-default")).toHaveValue("Unknown");
  await expect(panel.getByTestId("note-lookup-sentence")).toHaveText(
    "Each Customer Address row finds its Country by country_code and takes country_name; when the code is empty or has no match, the value is “Unknown”.",
  );
  await expect(panel.getByTestId("input-cube-rule")).toHaveCount(0);

  await kindButton(page, "Direct copy").click();
  await expect.poll(async () => (await cubeMappingRow(country))?.kind).toBe("direct");
  await expect(panel.getByTestId("input-cube-rule")).toBeVisible();
  await expectCubePanelAt(page, country);
  await kindButton(page, "Lookup").click();
  await expect.poll(async () => (await cubeMappingRow(country))?.kind).toBe("lookup");
  expect(await cubeMappingRow(country)).toMatchObject({ lookup_relationship_id: locates, lookup_default: "Unknown" });
  await expect(panel.getByTestId("input-cube-lookup-default")).toHaveValue("Unknown");

  // Dim Product.sku reads Product.sku; Product has one relationship (Product → Order Line): Lookup chooses it
  const sku = cubeMappingId("prod.sku");
  const skuPanel = await openCubeMapping(page, sku);
  await kindButton(page, "Lookup").click();
  await expect.poll(async () => (await cubeMappingRow(sku))?.lookup_relationship_id).toBe(seedId(RETAIL, "relationship:product>line"));
  await expect(skuPanel.getByTestId("select-cube-lookup-via").locator("option:checked")).toHaveText("Product → Order Line (is ordered on)");
  await expect(skuPanel.getByTestId("input-cube-lookup-default")).toBeFocused();

  // Dim Customer.city reads two attributes (test data): Lookup is refused with a toast
  const city = cubeMappingId("cust.city");
  await asPersonOnCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const state = await mappingModel(s);
    const m = state.cubeMappings.find((x) => x.id === city)!;
    const zip = state.attributes.find((a) => a.name === "zip" || a.name === "postal_code" || a.name === "street_line1")!;
    return addCubeMappingInput(ctx, access, state, { mappingId: city, expectedVersion: m.version, attributeId: zip.id });
  });
  await page.reload();
  await openCubeMapping(page, city);
  await kindButton(page, "Lookup").click();
  await expectToast(page, "A lookup reads one attribute, the dictionary's value. Remove the others first.");
  expect((await cubeMappingRow(city))?.kind).toBe("transform");
});

test("S18-06: an approved lookup goes back to review when its relationship or its value for no match changes, not its note", async ({ page }) => {
  const sku = cubeMappingId("prod.sku");
  await signInAs(page, "Łukasz");
  await openStar(page);
  const panel = await openCubeMapping(page, sku);
  expect((await cubeMappingRow(sku))?.status).toBe("approved");
  await kindButton(page, "Lookup").click();
  await expect.poll(async () => (await cubeMappingRow(sku))?.status).toBe("review");

  const approve = async () => {
    await expectCubePanelAt(page, sku);
    await statusButton(page, "Approved").click();
    await expect.poll(async () => (await cubeMappingRow(sku))?.status).toBe("approved");
    await expectCubePanelAt(page, sku);
  };
  await approve();
  const note = panel.getByTestId("input-cube-note");
  await note.fill("Names from the product master.");
  await note.blur();
  await expect.poll(async () => (await cubeMappingRow(sku))?.note).toBe("Names from the product master.");
  expect((await cubeMappingRow(sku))?.status).toBe("approved");

  await expectCubePanelAt(page, sku);
  const noMatch = panel.getByTestId("input-cube-lookup-default");
  await noMatch.fill("Unknown");
  await noMatch.blur();
  await expect.poll(async () => (await cubeMappingRow(sku))?.status).toBe("review");
  expect((await cubeMappingRow(sku))?.lookup_default).toBe("Unknown");

  await approve();
  await panel.getByTestId("select-cube-lookup-via").selectOption("");
  await expect.poll(async () => (await cubeMappingRow(sku))?.status).toBe("review");
  expect((await cubeMappingRow(sku))?.lookup_relationship_id).toBeNull();
});
