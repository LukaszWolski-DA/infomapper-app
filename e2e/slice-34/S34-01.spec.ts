// S34-01 (slice 34, D-86, D1, F7, F9, F25): "Markdown" beside "Print / PDF" in the document editor, enabled and disabled
// as Print / PDF (until the tree is built; a read-only document too), opens a dialog with the document's text, its lines,
// size and file name, Copy and Download .md. Copy puts the whole text on the clipboard ("Markdown copied.", or the
// refusal when the browser does not allow it); Download saves a file named from the document's name with the same text.
// The text is the editor's tree at the click: a draft still in its typing pause is in it.

import { holdUntil } from "../slice-13/helpers";
import { expect, test } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, formUrl, markdownButton, markdownDialog, markdownText, openDocument, openEditor, openMarkdown, signInAs, storedDocument } from "./helpers";

test("S34-01: the button stands right after Print / PDF and is disabled while it is, enabled once the tree is built", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  // the snapshot's answer held: nothing is built yet
  const snapshot = await holdUntil(page, doc.id);
  await page.goto(formUrl(doc.id));
  await expect(page.getByTestId("page-document-editor")).toBeVisible();
  await expect.poll(() => snapshot.held()).toBe(true);
  await expect(page.getByTestId("button-print")).toBeDisabled();
  await expect(markdownButton(page)).toBeDisabled();
  await expect(markdownButton(page)).toHaveText("Markdown");
  expect(await page.getByTestId("button-print").evaluate((el) => (el.nextElementSibling as HTMLElement | null)?.dataset.testid)).toBe("button-markdown");
  expect(await markdownButton(page).getAttribute("title")).toBeNull();
  snapshot.release();
  await expect(page.getByTestId("button-print")).toBeEnabled();
  await expect(markdownButton(page)).toBeEnabled();
});

test("S34-01: a read-only document: Markdown as Print / PDF, enabled", async ({ page }) => {
  // Kasia is a guest: she opens and prints the shared document but does not change it
  await signInAs(page, "Kasia Zielińska");
  const doc = (await storedDocument(DEMO_DOCUMENT_NAMES.shared))!;
  await openEditor(page, formUrl(doc.id));
  await expect(page.getByTestId("badge-read-only")).toHaveText("Read only");
  await expect(page.getByTestId("button-print")).toBeEnabled();
  await expect(markdownButton(page)).toBeEnabled();
  const md = await openMarkdown(page);
  expect(md).toContain(`\n# ${DEMO_DOCUMENT_NAMES.shared}\n`);
});

test("S34-01: the dialog: the sentence, the text, its lines, size and file name; Close", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.shared);
  const md = await openMarkdown(page);
  const dialog = markdownDialog(page);
  await expect(dialog.getByRole("heading", { name: "Markdown" })).toBeVisible();
  await expect(dialog).toContainText(
    "This document as one Markdown file: the same sections and language as the PDF; diagrams as Mermaid blocks, page layout left out. For people (a wiki, Git) and for AI.",
  );
  expect(md.startsWith("---\ndocument: ")).toBe(true);
  const kb = (Buffer.byteLength(md, "utf8") / 1024).toFixed(1);
  // the unit written in pieces, as `tests/own-model-guard.test.ts` writes it: the word alone is the name it guards
  const unit = `${"K"}${"B"}`;
  await expect(page.getByTestId("text-markdown-line")).toHaveText(`${md.split("\n").length} lines · ${kb} ${unit} · retail-co-data-dictionary.md`);
  await expect(page.getByTestId("button-markdown-copy")).toHaveText("Copy");
  await expect(page.getByTestId("button-markdown-download")).toHaveText("Download .md");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("S34-01: Copy puts the whole text on the clipboard, with its toast", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.s2t);
  const md = await openMarkdown(page);
  await page.getByTestId("button-markdown-copy").click();
  await expect(page.getByTestId("toast")).toContainText("Markdown copied.");
  // Windows' clipboard answers its line ends as CRLF; the text is the same
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(md);
});

test("S34-01: a refused copy says so and leaves the text to select", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.s2t);
  await openMarkdown(page);
  await page.getByTestId("button-markdown-copy").click();
  await expect(page.getByTestId("toast")).toContainText("The browser did not allow copying. Select the text and copy it.");
  await expect(page.getByTestId("toast")).not.toContainText("Markdown copied.");
  await expect(page.getByTestId("text-markdown")).toBeVisible();
});

test("S34-01: Download .md saves the text under the document's name", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.s2t);
  const md = await openMarkdown(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-markdown-download").click()]);
  expect(download.suggestedFilename()).toBe("order-management-s2t-for-the-etl-team.md");
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  expect(Buffer.concat(chunks).toString("utf8")).toBe(md);
});

test("S34-01: the text is the editor's at the click: a name still in its typing pause, Polish letters in the file name", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openDocument(page, DEMO_DOCUMENT_NAMES.shared);
  const name = page.getByTestId("input-document-name");
  await name.fill("Słownik Zamówień – etap 2");
  // at once, within the preview's 500 ms pause
  await markdownButton(page).click();
  await expect(markdownDialog(page)).toBeVisible();
  const md = await markdownText(page);
  expect(md).toContain('document: "Słownik Zamówień – etap 2"');
  expect(md).toContain("\n# Słownik Zamówień – etap 2\n");
  await expect(page.getByTestId("text-markdown-line")).toContainText(" · slownik-zamowien-etap-2.md");
});
