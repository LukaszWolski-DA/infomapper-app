// The editor's schema (slice 4a, PRD items 16–17): only the formatting the server keeps (`sanitizeRich`, D-43), so
// pasted content from Word or a web page is reduced to it in the editor already: paragraphs, line breaks, bold, italic,
// bulleted and numbered lists, superscript, subscript, section headings (h4, from templates), links (http, https,
// mailto) and the four text colours. Template hints are a paragraph attribute shown as a placeholder decoration; the
// server never stores them.

import { Extension, Mark, type Extensions } from "@tiptap/core";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

export const TEXT_COLORS = ["warn", "attn", "ok", "info"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

const COLOR_CLASS = /(?:^|\s)tc-(warn|attn|ok|info)(?:\s|$)/;
export const SAFE_LINK = /^(https?:|mailto:)/i;

/** A text colour (D-43): `<span class="tc-warn">`; spans without one of the four classes are not kept. */
export const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => COLOR_CLASS.exec(el.className)?.[1] ?? null,
        renderHTML: (attrs: Record<string, unknown>) => (attrs.color ? { class: `tc-${String(attrs.color)}` } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span", getAttrs: (el: HTMLElement) => (COLOR_CLASS.test(el.className) ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

/** A template's grey hint on its empty paragraph (`data-ph`), shown by the placeholder below. */
const TemplateHint = Extension.create({
  name: "templateHint",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          hint: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute("data-ph"),
            renderHTML: (attrs: Record<string, unknown>) => (typeof attrs.hint === "string" && attrs.hint ? { "data-ph": attrs.hint } : {}),
          },
        },
      },
    ];
  },
});

export const editorExtensions = (): Extensions => [
  StarterKit.configure({
    heading: { levels: [4] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      protocols: ["mailto"],
      defaultProtocol: "https",
      HTMLAttributes: { target: "_blank", rel: "noopener", class: null },
      isAllowedUri: (url) => SAFE_LINK.test(url.trim()),
    },
  }),
  Superscript,
  Subscript,
  TextColorMark,
  TemplateHint,
  Placeholder.configure({
    placeholder: ({ node }) => (node.type.name === "paragraph" && typeof node.attrs.hint === "string" ? node.attrs.hint : ""),
    showOnlyCurrent: false,
    includeChildren: false,
  }),
];

/** What the link field adds: a URL as typed, an address with @ as mailto, anything else as https (as the prototype). */
export function linkTarget(raw: string): string {
  const v = raw.trim();
  if (SAFE_LINK.test(v)) return v;
  return v.includes("@") && !v.includes("/") ? `mailto:${v}` : `https://${v}`;
}
