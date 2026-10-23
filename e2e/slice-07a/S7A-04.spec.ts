import { expect, test } from "./fixtures";
import { giveFile, importNow, imports, loadModel, openWizard, RETAIL, reviewFile, sample, store, systemNamed, target } from "./helpers";

test("S7A-04: HR into a new system “HR”: every table and column new; system, tables, columns, relationships and the import written in one change group", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { new: "HR" }, "hr_snapshot_2026-10-20.csv", sample("hr_snapshot_2026-10-20.csv"));
  await expect(page.getByTestId("import-title")).toHaveText("Import sources into HR");
  await expect(page.getByTestId("filter-new")).toHaveText("10 new (2 tables)");
  await expect(page.getByTestId("review-table")).toHaveCount(2);
  await expect(page.getByTestId("review-table").first()).toHaveAttribute("data-status", "new");
  await expect(page.getByTestId("review-relationship")).toHaveCount(2);
  await expect(page.getByTestId("wizard-note")).toHaveText("Nothing is written until you import. The import is one undo step.");
  await importNow(page, "Imported into HR: 2 new tables, 10 new columns, 2 new relationships");

  const hr = (await systemNamed("HR"))!;
  const model = await loadModel();
  expect(model.sourceTables.filter((t) => t.source_system_id === hr.id).map((t) => t.name).sort()).toEqual(["departments", "employees"]);
  expect(model.sourceRelationships.map((r) => r.name).sort()).toEqual(["FK_employees_departments", "FK_employees_manager"]);
  const [imp] = await imports(hr.id);
  expect(imp).toMatchObject({ channel: "file", source_label: "hr_snapshot_2026-10-20.csv", tables_new: 2, columns_new: 10, relationships_new: 2 });
  const events = await store().changeEvents.list(RETAIL);
  const group = events.filter((e) => e.change_group_id === events.find((x) => x.object_type === "source_import")!.change_group_id);
  expect(new Set(group.map((e) => e.object_type))).toEqual(
    new Set(["source_system", "source_table", "source_column", "source_relationship", "source_relationship_column", "source_import"]),
  );
  // the tree shows the new system
  await expect(page.getByTestId("tree-system").filter({ hasText: "HR" })).toBeVisible();
});

test("S7A-04: a name another system has blocks Next with its message", async ({ page }) => {
  await openWizard(page);
  await giveFile(page, "import-file", "hr.csv", sample("hr_snapshot_2026-10-20.csv"));
  await target(page, { new: "crm" });
  await expect(page.getByTestId("wizard-note")).toHaveText("A system named crm already exists. Pick it under “An existing system”.");
  await expect(page.getByTestId("button-wizard-next")).toBeDisabled();
  await expect(page.getByTestId("wizard-step-2")).toBeDisabled();
});
