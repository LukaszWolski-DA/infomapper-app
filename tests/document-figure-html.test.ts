// Slice 27 (F3, F10, Q2, Q7): a figure in the document's HTML (its SVG once in a hidden holder, an image per part with
// its region, the turned wrapper, the captions, the anchor; the SVG and the caption escaped), the fonts embedded in an
// SVG, and the editor panels' cookie.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DocFigure } from "@/domain/document/content";
import { Nodes } from "@/modules/infodocumenter/ui/document-html";
import { figureFontCss, withFonts } from "@/modules/infodocumenter/ui/figure-images";
import { DEFAULT_DOC_PANELS, formatDocPanelsCookie, parseDocPanelsCookie } from "@/modules/infodocumenter/ui/panels-cookie";

const figure = (patch: Partial<DocFigure> = {}): DocFigure => ({
  key: "f1",
  entryId: "f1",
  number: 3,
  word: "Figure",
  caption: `Orders <b>&"`,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><style>text{}</style><text>A &lt;b&gt;</text></svg>`,
  faces: ["sans-400", "mono-400"],
  rot: false,
  parts: [{ x: 0, y: 0, w: 100, h: 50, wmm: 26.46, hmm: 13.23 }],
  partTexts: [],
  summary: "1 figure",
  ...patch,
});
const html = (f: DocFigure) => renderToStaticMarkup(createElement(Nodes, { nodes: [{ kind: "figure", figure: f }] }));

describe("a figure in the document's HTML (slice 27)", () => {
  it("holds its SVG once, escaped, and draws an image with its size, its caption and its anchor", () => {
    const out = html(figure());
    expect(out.match(/data-fig-src="f1"/g)).toHaveLength(1);
    expect(out).toContain('data-svg="&lt;svg xmlns=&quot;http://www.w3.org/2000/svg&quot;');
    expect(out).toContain('data-faces="sans-400 mono-400"');
    expect(out).toContain('<figure class="dfig" id="fg-3"');
    expect(out).toMatch(/<img class="dimg" alt="Orders &lt;b&gt;&amp;&quot;" data-fig="f1"/);
    expect(out).toContain("width:26.5mm;height:13.2mm");
    expect(out).not.toContain("data-view");
    expect(out).toContain("<figcaption>Figure 3. Orders &lt;b&gt;&amp;&quot;</figcaption>");
    expect(out).not.toContain("<b>");
  });

  it("draws each part as its own image of the one source, with its region and its words; only the first has the anchor", () => {
    const out = html(
      figure({
        parts: [
          { x: 0, y: 0, w: 66, h: 50, wmm: 100, hmm: 75 },
          { x: 50, y: 0, w: 50, h: 50, wmm: 76, hmm: 75 },
        ],
        partTexts: ["part 1 of 2", "part 2 of 2"],
      }),
    );
    expect(out.match(/data-fig-src=/g)).toHaveLength(1);
    expect(out.match(/<img /g)).toHaveLength(2);
    expect(out).toContain('data-view="0,0,66,50"');
    expect(out).toContain('data-view="50,0,50,50"');
    expect(out.match(/id="fg-3"/g)).toHaveLength(1);
    expect(out).toContain('class="dfig dtile"');
    expect(out).toContain('Figure 3b. Orders &lt;b&gt;&amp;&quot;<span class="dmuted"> (part 2 of 2)</span>');
  });

  it("turns a figure inside a wrapper of the turned size", () => {
    const out = html(figure({ rot: true, parts: [{ x: 0, y: 0, w: 100, h: 50, wmm: 200, hmm: 100 }] }));
    expect(out).toContain('class="dfig drot"');
    expect(out).toContain('<div class="drotw" style="width:100.0mm;height:200.0mm">');
    expect(out).toContain("transform:translateY(200.0mm) rotate(-90deg);transform-origin:0 0");
  });
});

describe("the fonts in a figure (Q2)", () => {
  it("embeds the faces it uses, by family and weight, first in its own style; a face not loaded is left out", () => {
    const fonts = { "sans-400": "AAAA", "mono-400": "BBBB" };
    expect(figureFontCss(["sans-400", "sans-600", "mono-400"], fonts)).toBe(
      "@font-face{font-family:'IBM Plex Sans';font-weight:400;src:url(data:font/woff2;base64,AAAA) format('woff2')}@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(data:font/woff2;base64,BBBB) format('woff2')}",
    );
    expect(withFonts("<svg><style>text{}</style></svg>", ["sans-400"], fonts)).toBe(
      "<svg><style>@font-face{font-family:'IBM Plex Sans';font-weight:400;src:url(data:font/woff2;base64,AAAA) format('woff2')}text{}</style></svg>",
    );
    expect(withFonts("<svg><style></style></svg>", ["sans-500"], fonts)).toBe("<svg><style></style></svg>");
  });
});

describe("the editor panels' cookie (Q7)", () => {
  it("keeps both widths within their bounds; anything else reads as the defaults", () => {
    expect(formatDocPanelsCookie({ left: 300, right: 400 })).toBe("300.400");
    expect(parseDocPanelsCookie("300.400")).toEqual({ left: 300, right: 400 });
    expect(parseDocPanelsCookie("100.900")).toEqual({ left: 200, right: 560 });
    expect(parseDocPanelsCookie("x")).toEqual(DEFAULT_DOC_PANELS);
    expect(parseDocPanelsCookie(undefined)).toEqual({ left: 250, right: 330 });
  });
});
