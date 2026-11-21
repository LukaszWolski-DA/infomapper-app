// Slice 34's helpers: the editor's "Markdown" button and its dialog, the dialog's text, and its Mermaid blocks.

import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

export * from "../slice-28/helpers";

export const markdownButton = (page: Page): Locator => page.getByTestId("button-markdown");
export const markdownDialog = (page: Page): Locator => page.getByTestId("dialog-markdown");

/** The box's text content, as Copy and Download take it. */
export const markdownText = (page: Page): Promise<string> => page.getByTestId("text-markdown").evaluate((el) => el.textContent ?? "");

/** Opens the dialog and answers the box's text. */
export async function openMarkdown(page: Page): Promise<string> {
  await markdownButton(page).click();
  await expect(markdownDialog(page)).toBeVisible();
  return markdownText(page);
}

/** The Markdown's `##` headings in order, without "Contents". */
export const sectionHeadings = (md: string, contents = "Contents"): string[] =>
  md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3))
    .filter((h) => h !== contents);

/** The PDF's section headings in order, from the preview's source (each without its number). */
export const pdfHeadings = (page: Page): Promise<string[]> =>
  page
    .getByTestId("document-source")
    .locator('[data-testid="document-section"] > h2')
    .evaluateAll((hs) =>
      hs.map((h) =>
        [...h.childNodes]
          .filter((n) => !(n instanceof HTMLElement && n.classList.contains("dnum")))
          .map((n) => n.textContent)
          .join(""),
      ),
    );

/** Every Mermaid block's body. */
export const mermaidBlocks = (md: string): string[] => [...md.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1]!);

type Parser = { parse: (text: string) => unknown };
export const MERMAID_VERSIONS = ["mermaid-v9", "mermaid-v10", "mermaid-v12"] as const;

/** "ok" or the parser's message, on each of the three versions (9.4.3's `parse` answers at once, the later a promise). */
export async function parsedOnEvery(block: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const v of MERMAID_VERSIONS) {
    const mermaid = ((await import(v)) as { default: Parser }).default;
    out[v] = await Promise.resolve()
      .then(() => mermaid.parse(block))
      .then(
        () => "ok",
        (e: unknown) => String(e instanceof Error ? e.message : e),
      );
  }
  return out;
}
