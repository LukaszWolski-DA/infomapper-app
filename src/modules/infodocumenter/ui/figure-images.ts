// A document's figures as images in the browser (slice 27, Q2, Q3, F10): each figure's SVG, held once in its hidden
// holder (`document-html.tsx`), becomes one blob URL with IBM Plex's unmodified files embedded for the faces it uses
// (an SVG shown through `<img>` sees none of the page's fonts), and each part's `<img>` shows its own region of it
// through an SVG view fragment (`#svgView(viewBox(…))`), so a figure in 36 parts is held once, not 36 times. The text
// stays text: a printed PDF keeps it searchable. Plain DOM, no React: the preview and the document page call it on the
// copy Paged.js lays out and on the quick sheet.

/** A face's WOFF2 file as base64, by `FigureFace` ("sans-400"). */
export type FigureFonts = Readonly<Partial<Record<string, string>>>;

const FACE_RULES: Readonly<Record<string, { family: string; weight: number }>> = {
  "sans-400": { family: "IBM Plex Sans", weight: 400 },
  "sans-500": { family: "IBM Plex Sans", weight: 500 },
  "sans-600": { family: "IBM Plex Sans", weight: 600 },
  "mono-400": { family: "IBM Plex Mono", weight: 400 },
  "mono-500": { family: "IBM Plex Mono", weight: 500 },
};

/** The `@font-face` rules of the faces a figure uses, with the files as `data:` URIs; nothing for a face not loaded. */
export function figureFontCss(faces: readonly string[], fonts: FigureFonts): string {
  return faces
    .map((f) => {
      const rule = FACE_RULES[f], data = fonts[f];
      return rule && data ? `@font-face{font-family:'${rule.family}';font-weight:${rule.weight};src:url(data:font/woff2;base64,${data}) format('woff2')}` : "";
    })
    .join("");
}

/** The SVG with its faces embedded: the rules go first into its own `<style>`. */
export const withFonts = (svg: string, faces: readonly string[], fonts: FigureFonts): string => {
  const css = figureFontCss(faces, fonts);
  return css ? svg.replace("<style>", `<style>${css}`) : svg;
};

/** The holders of a root's figures. */
const holdersOf = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>("[data-fig-src]")];

/**
 * The blob URLs of the figures a page shows, one per distinct SVG; `attach` gives a root's images their sources,
 * `retain` revokes the URLs no root shows any more, `dispose` all of them.
 */
export class FigureImages {
  private readonly urls = new Map<string, string>();

  constructor(private fonts: FigureFonts = {}) {}

  setFonts(fonts: FigureFonts) {
    this.fonts = fonts;
  }

  private urlOf(svg: string, faces: readonly string[]): string {
    let url = this.urls.get(svg);
    if (!url) {
      url = URL.createObjectURL(new Blob([withFonts(svg, faces, this.fonts)], { type: "image/svg+xml" }));
      this.urls.set(svg, url);
    }
    return url;
  }

  /** Gives every figure image in `root` its source: the whole figure, or its part's region of it. */
  attach(root: ParentNode): void {
    const byKey = new Map<string, string>();
    for (const h of holdersOf(root)) {
      const svg = h.getAttribute("data-svg");
      const key = h.getAttribute("data-fig-src");
      if (svg && key) byKey.set(key, this.urlOf(svg, (h.getAttribute("data-faces") ?? "").split(" ").filter(Boolean)));
    }
    for (const img of root.querySelectorAll<HTMLImageElement>("img[data-fig]")) {
      const url = byKey.get(img.getAttribute("data-fig") ?? "");
      if (!url) continue;
      const view = img.getAttribute("data-view");
      const src = view ? `${url}#svgView(viewBox(${view}))` : url;
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    }
  }

  /** Revokes every URL whose SVG none of `roots` holds. */
  retain(roots: readonly (ParentNode | null | undefined)[]): void {
    const kept = new Set<string>();
    for (const r of roots) if (r) for (const h of holdersOf(r)) kept.add(h.getAttribute("data-svg") ?? "");
    for (const [svg, url] of this.urls)
      if (!kept.has(svg)) {
        URL.revokeObjectURL(url);
        this.urls.delete(svg);
      }
  }

  dispose(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

/** The holders out of a copy before Paged.js lays it out: they draw nothing and hold the SVG text. */
export function removeHolders(root: ParentNode): void {
  for (const h of holdersOf(root)) h.remove();
}

/** Every figure image of a root decoded (a broken one counts as done): the pages are ready to print. */
export async function imagesReady(root: ParentNode): Promise<void> {
  await Promise.all([...root.querySelectorAll<HTMLImageElement>("img[data-fig]")].map((img) => img.decode().catch(() => undefined)));
}
