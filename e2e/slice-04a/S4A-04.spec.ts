import { createRequirement, updateRequirement } from "../../src/domain/commands/requirement";
import { expect, test } from "./fixtures";
import { asPerson, callActionDirectly, captureActionId, loadRequirements, openCanvas, openRequirement, requirementByKey, SEED_IDS, signInAs } from "./helpers";

test("S4A-04: the editor on an empty Business rule description: template headings with hints; two written sections are stored without hints or empty sections, with bold, a colour and a link; Ctrl+Enter saves, Esc with changes needs a second Esc, one undo restores; the server strips script, onclick and javascript: links", async ({ page }) => {
  // an empty Business rule, written through the domain
  const created = await asPerson(SEED_IDS.userAnna, (ctx, access) => createRequirement(ctx, access, { requirements: [] }, {}));
  await asPerson(SEED_IDS.userAnna, (ctx, access) =>
    updateRequirement(ctx, access, { requirements: [created.requirement] }, { requirementId: created.requirement.id, expectedVersion: 1, field: "kind", value: "business_rule" }),
  );

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-106");
  await expect(page.getByTestId("field-req-description-view")).toHaveText("No description yet. Click to write it; a business rule template guides you.");
  await page.getByTestId("field-req-description-edit").click();
  const editor = page.getByTestId("rte-content");
  await expect(editor.locator("h4")).toHaveText(["The rule in words", "Input data", "Logic, step by step", "Edge cases and exceptions", "Examples", "Source of the rule"]);
  await expect(editor.locator("p.is-empty").first()).toHaveAttribute("data-placeholder", "One or two sentences a business user would agree with");
  await expect(editor).toBeFocused();

  // the first section: a bold word and a coloured word
  await page.keyboard.type("Total equals the ");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("sum");
  await page.keyboard.press("Control+b");
  await page.keyboard.type(" of its lines.");
  await page.keyboard.press("Shift+Home");
  await page.getByTestId("button-rte-color-ok").click();
  // the Examples section, with a link
  await editor.locator('p[data-ph^="Input → expected result"]').click();
  await page.keyboard.type("See ");
  await page.getByTestId("button-rte-link").click();
  await page.getByTestId("input-rte-url").fill("example.com/rules");
  await page.getByTestId("input-rte-url").press("Enter");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("dialog-rich-text")).toHaveCount(0);

  await expect.poll(async () => (await requirementByKey("REQ-106")).description_html).not.toBeNull();
  const saved = await requirementByKey("REQ-106");
  expect(saved.description_html).toBe(
    '<h4>The rule in words</h4><p><span class="tc-ok">Total equals the </span><strong><span class="tc-ok">sum</span></strong><span class="tc-ok"> of its lines.</span></p>' +
      '<h4>Examples</h4><p>See <a href="https://example.com/rules" target="_blank" rel="noopener">example.com/rules</a></p>',
  );
  expect(saved.description_text).toBe("The rule in words\n\nTotal equals the sum of its lines.\n\nExamples\n\nSee example.com/rules");
  await expect(page.getByTestId("field-req-description-view").locator("strong")).toHaveText("sum");

  // one undo restores the previous (empty) description
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await requirementByKey("REQ-106")).description_html).toBeNull();

  // Esc with changes asks first; the second Esc discards
  await expect(page.getByTestId("field-req-description-view")).toContainText("No description yet.");
  await page.getByTestId("field-req-description-edit").click();
  await expect(editor).toBeFocused();
  await page.keyboard.type("Draft text");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("text-rte-message")).toHaveText("Unsaved changes. Press Esc or Cancel again to discard them.");
  await expect(page.getByTestId("dialog-rich-text")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("dialog-rich-text")).toHaveCount(0);
  expect((await requirementByKey("REQ-106")).description_html).toBeNull();

  // sent directly, the server keeps only the allowed formatting
  const r = await requirementByKey("REQ-106");
  await page.getByTestId("field-req-description-edit").click();
  await expect(editor).toBeFocused();
  await page.keyboard.type("x");
  const actionId = await captureActionId(page, () => page.keyboard.press("Control+Enter"));
  await expect.poll(async () => (await requirementByKey("REQ-106")).version).toBe(r.version + 1);
  const evil = '<p onclick="alert(1)">Hi <script>alert(2)</script><a href="javascript:alert(3)">there</a> <strong>ok</strong></p>';
  await callActionDirectly(page, actionId, [r.workspace_id, { requirementId: r.id, expectedVersion: r.version + 1, field: "description", value: evil }]);
  await expect.poll(async () => (await requirementByKey("REQ-106")).description_html).toBe("<p>Hi there <strong>ok</strong></p>");
  expect((await loadRequirements()).length).toBe(6);
});
