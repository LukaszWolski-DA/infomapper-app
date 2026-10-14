// Rich text on the server (AD-17, D-42, D-43; slice 4a, PRD item 11): every `*_html` the server stores goes through
// `sanitizeRich`, whatever the client sent, and the server derives `*_text` from the result. The allow-list is the
// prototype's `sanitizeRich`: paragraphs, line breaks, bold, italic, lists, superscript, subscript, section headings
// (h4), links (http, https and mailto only, opened in a new tab) and spans with one of the four text colours. Any other
// element keeps its text and loses the element; scripts, styles, frames, embedded objects, SVG, MathML, templates and
// noscript go with their content. Then `finalizeRich`'s clean-up: template hints are never stored, section headings
// followed by nothing are removed, and empty paragraphs go. Empty content is stored as null in both columns.
// Pure: parsed with htmlparser2's streaming parser, no DOM.

import { Parser } from "htmlparser2";

export interface RichTextPair {
  html: string | null;
  text: string | null;
}

/** The four text colours (D-43): `<span class="tc-…">`. */
export const TEXT_COLORS = ["warn", "attn", "ok", "info"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

type Node = { tag: string; attrs: Record<string, string>; children: Node[] } | { text: string };
type Element = Extract<Node, { tag: string }>;

/** Elements dropped together with everything inside them. */
const DROPPED = new Set(["script", "style", "noscript", "template", "iframe", "object", "embed", "svg", "math"]);

/** Allowed elements and what they become (`b` is bold, `div` a paragraph, as in the prototype). */
const ALLOWED: Record<string, string> = {
  p: "p",
  div: "p",
  br: "br",
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  ul: "ul",
  ol: "ol",
  li: "li",
  sup: "sup",
  sub: "sub",
  h4: "h4",
  a: "a",
  span: "span",
};

const SAFE_HREF = /^(https?:|mailto:)/i;

function parse(html: string): Node[] {
  const root: Element = { tag: "#root", attrs: {}, children: [] };
  const stack: Element[] = [root];
  let dropDepth = 0;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (dropDepth > 0 || DROPPED.has(name)) {
          dropDepth++;
          return;
        }
        const el: Element = { tag: name, attrs, children: [] };
        stack[stack.length - 1]!.children.push(el);
        stack.push(el);
      },
      ontext(text) {
        if (dropDepth === 0) stack[stack.length - 1]!.children.push({ text });
      },
      onclosetag() {
        if (dropDepth > 0) dropDepth--;
        else if (stack.length > 1) stack.pop();
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();
  return root.children;
}

/** The allowed form of a list of nodes: unknown elements unwrapped, attributes reduced to the allowed ones. */
function clean(nodes: readonly Node[]): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    if ("text" in n) {
      out.push(n);
      continue;
    }
    const tag = ALLOWED[n.tag];
    if (!tag) {
      out.push(...clean(n.children));
      continue;
    }
    if (tag === "br") {
      out.push({ tag, attrs: {}, children: [] });
      continue;
    }
    if (tag === "a") {
      const href = (n.attrs.href ?? "").trim();
      if (!SAFE_HREF.test(href)) {
        out.push(...clean(n.children));
        continue;
      }
      out.push({ tag, attrs: { href, target: "_blank", rel: "noopener" }, children: clean(n.children) });
      continue;
    }
    if (tag === "span") {
      const color = /(?:^|\s)tc-(warn|attn|ok|info)(?:\s|$)/.exec(n.attrs.class ?? "")?.[1];
      if (!color) {
        out.push(...clean(n.children));
        continue;
      }
      out.push({ tag, attrs: { class: `tc-${color}` }, children: clean(n.children) });
      continue;
    }
    out.push({ tag, attrs: {}, children: clean(n.children) });
  }
  return out;
}

const textOf = (n: Node): string => ("text" in n ? n.text : n.children.map(textOf).join(""));
const isBlank = (n: Node): boolean => !textOf(n).trim();

/**
 * `finalizeRich` at the top level: empty paragraphs (template hints left empty) go, then section headings followed by
 * nothing or by another heading. Loose inline content between blocks is wrapped in a paragraph.
 */
function finalize(nodes: Node[]): Node[] {
  const blocks: Node[] = [];
  let loose: Node[] = [];
  const flush = () => {
    if (loose.some((n) => !isBlank(n) || ("tag" in n && n.tag === "br"))) blocks.push({ tag: "p", attrs: {}, children: loose });
    loose = [];
  };
  for (const n of nodes) {
    if ("tag" in n && ["p", "h4", "ul", "ol", "li"].includes(n.tag)) {
      flush();
      blocks.push(n.tag === "li" ? { tag: "ul", attrs: {}, children: [n] } : n);
    } else loose.push(n);
  }
  flush();
  const kept = blocks.filter((b) => !isBlank(b));
  return kept.filter((b, i) => !("tag" in b && b.tag === "h4" && (i === kept.length - 1 || (kept[i + 1] as Element).tag === "h4")));
}

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

function serialize(nodes: readonly Node[]): string {
  return nodes
    .map((n) => {
      if ("text" in n) return escapeText(n.text);
      if (n.tag === "br") return "<br>";
      const attrs = Object.entries(n.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join("");
      return `<${n.tag}${attrs}>${serialize(n.children)}</${n.tag}>`;
    })
    .join("");
}

/** Plain text: paragraphs and headings separated by a blank line, list items and line breaks by a newline. */
function plain(nodes: readonly Node[]): string {
  const block = (n: Node): string => {
    if ("text" in n) return n.text;
    if (n.tag === "br") return "\n";
    if (n.tag === "ul" || n.tag === "ol") return n.children.map(block).filter((t) => t.trim()).join("\n");
    return n.children.map(block).join("");
  };
  return nodes
    .map(block)
    .map((t) => t.replace(/[ \t]+\n/g, "\n").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** The stored pair for rich text as the client sent it: sanitized HTML and its plain text, or null in both when empty. */
export function sanitizeRich(html: string | null | undefined): RichTextPair {
  const nodes = finalize(clean(parse(html ?? "")));
  const text = plain(nodes);
  if (!text) return { html: null, text: null };
  return { html: serialize(nodes), text };
}
