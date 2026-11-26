// Slice 37 (S37-02, S37-03, Q6): the automatic UI check. It opens the demo on a dev server of its own and, on every
// screen of the list at 1280, 1440 and 1920 px in light and dark and at 390 px in light, lists:
// - controls overlapping another by more than 2 px (one not inside the other);
// - controls past the screen's edge;
// - targets smaller than 24 × 24 px (with WCAG 2.5.8's spacing exception decided);
// - text cut without an ellipsis;
// - a page wider than the screen;
// - an inventory of every control's height, font size, radius and edge, grouped into kinds.
// It writes a Markdown report, its JSON and the screenshots. The rules are pure (scripts/lib/ui-check-rules.ts).
//
//   npm run ui:check -- --label before            # .data/ui-check/before-<yyyymmdd-hhmm>/
//   npm run ui:check -- --label after --only canvas,editor --widths 1440 --themes light
//   npm run ui:check -- --url http://127.0.0.1:3001 --label demo    # against a running server (its data, not ours)
//   npm run ui:check -- --compare <before folder> <after folder>    # compare.html: the screenshots side by side
//
// Its data (A8, Łukasz 26 November 2026) is a file of its own, .data/ui-check-db.json, reset from the demo data on
// every run, with a few long names. It never reads or writes the development file or the demo's file. The server is
// `next dev` on 127.0.0.1:3400 with its own build folder (.next-ui-check). Not part of the e2e run or of CI.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { addSeedDemoData } from "../src/compose/seed";
import { resetDevData } from "../src/data/local/dev-data";
import type { DevDb } from "../src/data/local/schema";
import { GROUPS, describe, isCutWithoutEllipsis, kinds, overlaps, pastTheEdge, smallTargets, spilling, crowdedTexts, type Control, type KindCount, type TextBox } from "./lib/ui-check-rules";

const PORT = 3400;
const HOST = "127.0.0.1";
const DATA = path.resolve(".data", "ui-check-db.json");
const REFUSED = [path.resolve(".data", "dev-db.json"), path.resolve(".data", "demo-db.json")].map((p) => p.toLowerCase());
const OUT_ROOT = path.resolve(".data", "ui-check");

// ---------- arguments ----------
const argv = process.argv.slice(2);
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const list = (v: string | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

type Theme = "light" | "dark";
interface View {
  readonly width: number;
  readonly height: number;
  readonly theme: Theme;
}
const ALL_VIEWS: readonly View[] = [
  ...[1280, 1440, 1920].flatMap((width) => (["light", "dark"] as const).map((theme) => ({ width, height: 900, theme }))),
  { width: 390, height: 844, theme: "light" },
];

// ---------- the data ----------
interface Ids {
  ws: string;
  project: string;
  canvas: string;
  starProject: string;
  star: string;
  entity: string;
  attribute: string;
  table: string;
  mapping: string;
  requirement: string;
  note: string | null;
  cubeMapping: string;
  fact: string;
  dimension: string;
  document: string;
}
type Row = Record<string, unknown> & { id: string; workspace_id?: string; deleted_at?: string | null };
const rows = (db: DevDb, table: string) => ((db as unknown as Record<string, Row[]>)[table] ?? []).filter((r) => !r.deleted_at);
const named = (db: DevDb, table: string, name: string, ws?: string) => {
  const r = rows(db, table).find((x) => x.name === name && (!ws || x.workspace_id === ws));
  if (!r) throw new Error(`The demo has no ${table} named "${name}".`);
  return r;
};

/** A few long names (A8): an entity, an attribute, a project, a canvas and a document section's heading. */
function longNames(db: DevDb, ws: string): void {
  named(db, "entity", "Customer Address", ws).name = "Customer postal address for billing, delivery and returns";
  const customer = named(db, "entity", "Customer", ws);
  const attr = rows(db, "attribute").filter((a) => a.entity_id === customer.id && !a.is_primary_key).sort((a, b) => Number(a.sort_order) - Number(b.sort_order))[1];
  if (attr) attr.name = "preferred_contact_channel_for_marketing_and_service_messages";
  named(db, "project", "Order management", ws).name = "Order management and fulfilment across every sales channel";
  named(db, "canvas", "Order lines & products", ws).name = "Order lines, products and their price history per sales channel";
  const doc = named(db, "document_definition", "Order management – S2T for the ETL team", ws) as Row & { sections: { heading: string | null }[] };
  if (doc.sections[0]) doc.sections[0].heading = "Source-to-target mapping of every order table into the logical model, with its transformation rules";
}

function idsOf(db: DevDb): Ids {
  const ws = named(db, "workspace", "Retail Co – DWH").id;
  const project = named(db, "project", "Customer 360", ws).id;
  const canvas = named(db, "canvas", "Customer & orders", ws).id;
  const star = named(db, "canvas", "Sales star", ws).id;
  const link = rows(db, "project_canvas").find((l) => l.canvas_id === star);
  const entity = named(db, "entity", "Customer", ws).id;
  const items = rows(db, "canvas_item").filter((i) => i.canvas_id === canvas);
  const onCanvas = new Set(items.map((i) => i.entity_id).filter(Boolean));
  const mapping = rows(db, "mapping").find((m) => m.workspace_id === ws && onCanvas.has(rows(db, "attribute").find((a) => a.id === m.attribute_id)?.entity_id as string));
  const tableItem = items.find((i) => i.source_table_id);
  const cube = rows(db, "cube_entity").filter((c) => c.workspace_id === ws);
  return {
    ws,
    project,
    canvas,
    starProject: (link?.project_id as string) ?? project,
    star,
    entity,
    attribute: (mapping?.attribute_id as string) ?? rows(db, "attribute").find((a) => a.entity_id === entity)!.id,
    table: (tableItem?.source_table_id as string) ?? rows(db, "source_table").find((t) => t.workspace_id === ws)!.id,
    mapping: mapping!.id,
    requirement: rows(db, "requirement").find((r) => r.workspace_id === ws)!.id,
    note: rows(db, "note").find((n) => n.canvas_id === canvas)?.id ?? null,
    cubeMapping: rows(db, "cube_mapping").find((m) => m.workspace_id === ws)!.id,
    fact: cube.find((c) => c.role === "fact")!.entity_id as string,
    dimension: cube.find((c) => c.role === "dimension")!.entity_id as string,
    document: named(db, "document_definition", "Order management – S2T for the ETL team", ws).id,
  };
}

// ---------- the screens ----------
interface Screen {
  readonly id: string;
  readonly path: string;
  /** What shows the screen is ready. */
  readonly ready: string;
  /** Clicks after the page is ready (a tab, a dialog). */
  readonly then?: (page: Page) => Promise<void>;
  /** Not shown below this width (the left panel and its tabs: hidden up to 1000 px). */
  readonly minWidth?: number;
}

function screens(ids: Ids, wsTabs: readonly string[], leftTabs: readonly string[]): Screen[] {
  const w = `/w/${ids.ws}`;
  const canvas = `${w}/p/${ids.project}/c/${ids.canvas}`;
  const star = `${w}/p/${ids.starProject}/c/${ids.star}`;
  const NODE = ".react-flow__node";
  return [
    { id: "workspace-home", path: w, ready: '[data-testid="page-workspace-home"]' },
    ...wsTabs.map((tab) => ({ id: `workspace-${tab}`, path: `${w}?tab=${tab}`, ready: '[data-testid="page-workspace-home"]' })),
    { id: "project-home", path: `${w}/p/${ids.project}`, ready: '[data-testid="page-project-home"]' },
    { id: "canvas", path: canvas, ready: NODE },
    ...leftTabs.map((tab) => ({
      id: `canvas-left-${tab.replace(/^tab-/, "")}`,
      path: canvas,
      ready: NODE,
      minWidth: 1001,
      then: (page: Page) => page.locator(`[data-testid="panel-left"] [data-testid="${tab}"]`).click(),
    })),
    { id: "canvas-entity", path: `${canvas}?card=entity:${ids.entity}`, ready: NODE },
    { id: "canvas-attribute", path: `${canvas}?row=${ids.attribute}`, ready: NODE },
    { id: "canvas-source-table", path: `${canvas}?card=source:${ids.table}`, ready: NODE },
    { id: "canvas-mapping", path: `${canvas}?map=${ids.mapping}`, ready: NODE },
    { id: "canvas-requirement", path: `${canvas}?req=${ids.requirement}`, ready: NODE },
    ...(ids.note ? [{ id: "canvas-note", path: `${canvas}?note=${ids.note}`, ready: NODE }] : []),
    {
      id: "dialog-delete-entity",
      path: `${canvas}?card=entity:${ids.entity}`,
      ready: NODE,
      then: async (page: Page) => {
        await page.getByTestId("button-delete-entity").click();
        await page.getByRole("dialog").waitFor();
      },
    },
    // slice 37, step 3b: the toolbox, a concept's menu, the import wizard, the rich-text dialog and the concept picker
    {
      id: "canvas-toolbox",
      path: canvas,
      ready: NODE,
      then: async (page: Page) => {
        const pane = page.locator(".react-flow__pane");
        const box = (await pane.boundingBox())!;
        await page.mouse.click(box.x + 24, box.y + box.height - 40, { button: "right" });
        await page.getByTestId("menu-toolbox").waitFor();
      },
    },
    {
      id: "canvas-concept-menu",
      path: canvas,
      ready: NODE,
      minWidth: 1001,
      then: async (page: Page) => {
        await page.locator('[data-testid="panel-left"] [data-testid="tab-model"]').click();
        await page.getByTestId("tree-concept-head").first().hover();
        await page.getByTestId("button-concept-menu").first().click();
        await page.getByRole("menu").waitFor();
      },
    },
    {
      id: "dialog-import",
      path: canvas,
      ready: NODE,
      minWidth: 1001,
      then: async (page: Page) => {
        await page.locator('[data-testid="panel-left"] [data-testid="tab-sources"]').click();
        await page.getByTestId("button-import-sources").click();
        await page.getByTestId("dialog-import").waitFor();
      },
    },
    {
      id: "dialog-rich-text",
      path: `${canvas}?card=entity:${ids.entity}`,
      ready: NODE,
      then: async (page: Page) => {
        await page.getByTestId("field-entity-definition-view").click();
        await page.getByTestId("dialog-rich-text").waitFor();
      },
    },
    // slice 37, step 4: the top bar's menus and switches, a view-state chip, the Changes bar
    {
      id: "canvas-focus",
      path: `${canvas}?card=entity:${ids.entity}`,
      ready: NODE,
      then: async (page: Page) => {
        const focus = page.getByTestId("button-focus");
        if (await focus.isVisible()) await focus.click();
        else {
          await page.getByTestId("button-more-tools").click();
          await page.getByTestId("more-focus").click();
        }
        await page.locator('[data-testid^="chip-"]').first().waitFor();
      },
    },
    {
      id: "canvas-changes",
      path: canvas,
      ready: NODE,
      minWidth: 1001,
      then: async (page: Page) => {
        const changes = page.getByTestId("button-changes");
        if (await changes.isVisible()) await changes.click();
        else {
          await page.getByTestId("button-more-tools").click();
          await page.getByTestId("more-changes").click();
        }
        await page.getByTestId("bar-changes").waitFor();
      },
    },
    {
      id: "canvas-user-menu",
      path: canvas,
      ready: NODE,
      then: async (page: Page) => {
        await page.getByTestId("indicator-user").click();
        await page.getByTestId("menu-user").waitFor();
      },
    },
    {
      id: "canvas-switcher",
      path: canvas,
      ready: NODE,
      then: async (page: Page) => {
        await page.getByTestId("switcher-workspace").click();
        await page.getByRole("menu").waitFor();
      },
    },
    {
      id: "canvas-more",
      path: canvas,
      ready: NODE,
      then: async (page: Page) => {
        const more = page.getByTestId("button-more-tools");
        if (await more.isVisible()) {
          await more.click();
          await page.getByRole("menu").waitFor();
        }
      },
    },
    { id: "star", path: star, ready: NODE },
    {
      id: "star-picker",
      path: star,
      ready: NODE,
      minWidth: 1001,
      then: async (page: Page) => {
        await page.locator('[data-testid="panel-left"] [role="tab"]').filter({ hasText: "Cube" }).click();
        await page.getByTestId("button-new-fact").click();
        await page.locator('[data-testid="picker-concept"][data-shown="true"]').waitFor();
      },
    },
    { id: "star-cube-mapping", path: `${star}?ext=cube_mapping:${ids.cubeMapping}`, ready: NODE },
    { id: "star-fact", path: `${star}?card=entity:${ids.fact}`, ready: NODE },
    { id: "star-dimension", path: `${star}?card=entity:${ids.dimension}`, ready: NODE },
    {
      id: "star-bus-matrix",
      path: star,
      ready: NODE,
      minWidth: 1001,
      then: async (page: Page) => {
        await page.locator('[data-testid="panel-left"] [role="tab"]').filter({ hasText: "Cube" }).click();
        await page.getByTestId("button-bus-matrix").click();
        await page.getByTestId("dialog-bus-matrix").waitFor();
      },
    },
    { id: "editor", path: `${w}/d/${ids.document}`, ready: '[data-testid="page-document-editor"]' },
    {
      id: "editor-section",
      path: `${w}/d/${ids.document}`,
      ready: '[data-testid="page-document-editor"]',
      then: (page: Page) => page.getByTestId("editor-section").nth(1).click(),
    },
  ];
}

// ---------- in the page ----------
interface Collected {
  controls: Control[];
  cut: { testId: string | null; tag: string; text: string; box: TextBox }[];
  scrollWidth: number;
  innerWidth: number;
}

/** Runs in the page as plain JavaScript (a string, so no build helper is serialised into it). */
const COLLECT = String.raw`(() => {
  const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="button"], summary, [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]';
  const EXEMPT = [[".react-flow__node", "canvas card (scales with zoom)"], [".pagedjs_pages, .dpages, [data-testid=document-host], [data-testid=document-quick-box]", "generated document"], [".react-flow__attribution", "a library's link (React Flow's attribution, kept as its licence asks)"]];
  const els = [...document.querySelectorAll(SEL)];
  const ids = new Map(els.map((e, i) => [e, i + 1]));
  const shown = (e) => {
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0 || n.hasAttribute("inert") || n.getAttribute("aria-hidden") === "true") return false;
    }
    return true;
  };
  const clipOf = (e, r) => {
    let x = r.left, y = r.top, rt = r.right, b = r.bottom;
    for (let n = e.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.overflowX !== "visible" || s.overflowY !== "visible" || s.contain.includes("paint") || s.contain === "strict") {
        const c = n.getBoundingClientRect();
        if (s.overflowX !== "visible" || s.contain === "strict" || s.contain.includes("paint")) { x = Math.max(x, c.left); rt = Math.min(rt, c.right); }
        if (s.overflowY !== "visible" || s.contain === "strict" || s.contain.includes("paint")) { y = Math.max(y, c.top); b = Math.min(b, c.bottom); }
      }
    }
    return rt - x > 0.5 && b - y > 0.5 ? { x, y, w: rt - x, h: b - y } : null;
  };
  const kindOf = (e) => {
    const t = e.tagName.toLowerCase(), type = (e.getAttribute("type") || "text").toLowerCase(), role = e.getAttribute("role");
    if (t === "select") return ["select", "select"];
    if (t === "textarea") return ["field", "textarea"];
    if (t === "input") return type === "checkbox" || type === "radio" ? ["check", "input[" + type + "]"] : type === "button" || type === "submit" ? ["button", "input[" + type + "]"] : ["field", "input[" + type + "]"];
    if (role === "tab") return ["tab", t + "[tab]"];
    if (t === "a") return ["link", "a"];
    return ["button", t === "button" ? "button" : t + "[" + (role || "button") + "]"];
  };
  const inlineLink = (e) => {
    if (e.tagName !== "A") return false;
    const p = e.parentElement;
    if (!p || !["P", "LI", "SPAN", "TD", "DD", "LABEL"].includes(p.tagName)) return false;
    return [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  };
  const controls = [];
  for (const e of els) {
    if (!shown(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) continue;
    const s = getComputedStyle(e);
    const [kind, tag] = kindOf(e);
    const inside = [];
    for (let n = e.parentElement; n; n = n.parentElement) if (ids.has(n)) inside.push(ids.get(n));
    const ex = EXEMPT.find(([sel]) => e.closest(sel));
    const bw = Math.max(parseFloat(s.borderTopWidth) || 0, parseFloat(s.borderBottomWidth) || 0);
    controls.push({
      id: ids.get(e), kind, tag, testId: e.getAttribute("data-testid"),
      text: (e.getAttribute("aria-label") || (kind === "check" ? (e.closest("label")?.innerText || (e.id && document.querySelector("label[for=\"" + e.id + "\"]")?.innerText) || "") : "") || e.innerText || (kind === "field" || kind === "select" ? "" : e.value) || e.getAttribute("title") || "").slice(0, 80),
      rect: { x: r.left, y: r.top, w: r.width, h: r.height }, visible: clipOf(e, r), inside, inline: inlineLink(e), exempt: ex ? ex[1] : null,
      floating: (() => { for (let n = e; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true; return false; })(),
      spill: s.overflowX === "visible" && e.tagName !== "INPUT" && e.tagName !== "SELECT" && e.tagName !== "TEXTAREA" ? Math.max(0, e.scrollWidth - e.clientWidth) : 0,
      // the text as shown: a name cut with an ellipsis inside its control ends at the control's edge (step 4: the
      // switchers' clipped text was read as running into the next switcher); text out of its box is "spill" instead
      textBox: (() => { const g = document.createRange(); g.selectNodeContents(e); const b = g.getBoundingClientRect(); if (!(e.innerText || "").trim() || b.width <= 0) return null; const x = Math.max(b.left, r.left), rt = Math.min(b.right, r.right); return rt > x ? { x, y: b.top, w: rt - x, h: b.height } : null; })(),
      coveredBy: (() => { const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!h || h === e || e.contains(h)) return null; for (let n = h; n; n = n.parentElement) if (ids.has(n)) return n.contains(e) ? null : ids.get(n); return e.contains(h) ? null : "other"; })(),
      look: { height: r.height, fontSize: parseFloat(s.fontSize), radius: parseFloat(s.borderTopLeftRadius) || 0, borderWidth: bw, borderColor: bw > 0 ? s.borderTopColor : "" },
    });
  }
  const cut = [];
  for (const e of document.body.querySelectorAll("*")) {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)) continue;
    const s = getComputedStyle(e);
    if (s.overflowX !== "hidden" && s.overflowX !== "clip") continue;
    if (e.scrollWidth <= e.clientWidth + 1) continue;
    if (EXEMPT.some(([sel]) => e.closest(sel)) || !shown(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 1.5 || r.height <= 1.5 || r.bottom < 0 || r.top > innerHeight) continue; // screen-reader-only text is 1 px
    cut.push({ testId: e.getAttribute("data-testid") || e.closest("[data-testid]")?.getAttribute("data-testid") || null, tag: e.tagName.toLowerCase(), text: e.innerText.replace(/\s+/g, " ").slice(0, 80),
      box: { overflowX: s.overflowX, textOverflow: s.textOverflow, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth } });
  }
  return { controls, cut, scrollWidth: document.documentElement.scrollWidth, innerWidth };
})()`;

// ---------- the server ----------
const portInUse = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect(port, HOST);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });

async function startServer(): Promise<ChildProcess> {
  if (await portInUse(PORT)) throw new Error(`Port ${PORT} is in use. Stop the server there first, or pass --url.`);
  const next = path.resolve("node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [next, "dev", "-p", String(PORT), "-H", HOST], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, INFOMAPPER_DEV_DB: DATA, NEXT_DIST_DIR: ".next-ui-check", PORT: String(PORT), INFOMAPPER_TEST_HOOKS: "" },
  });
  const log: string[] = [];
  child.stdout!.on("data", (d) => log.push(String(d)));
  child.stderr!.on("data", (d) => log.push(String(d)));
  const until = Date.now() + 180_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`The server stopped:\n${log.join("").slice(-2000)}`);
    try {
      const r = await fetch(`http://${HOST}:${PORT}/sign-in`);
      if (r.ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("The server did not answer within 180 s.");
}

function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

// ---------- one screen ----------
interface Result {
  screen: string;
  view: View;
  file: string;
  controls: Control[];
  overlaps: ReturnType<typeof overlaps>;
  spills: Control[];
  crowded: ReturnType<typeof crowdedTexts>;
  past: Control[];
  small: ReturnType<typeof smallTargets>;
  cut: Collected["cut"];
  pageWider: number;
  error?: string;
}

async function signIn(context: BrowserContext, base: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${base}/sign-in`, { timeout: 180_000 });
  await page.getByTestId("button-dev-user").filter({ hasText: "Łukasz" }).click();
  await page.getByTestId("bar-top").waitFor({ timeout: 120_000 });
  return page;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

async function check(page: Page, base: string, screen: Screen, view: View, dir: string): Promise<Result> {
  const name = `${screen.id}--${view.width}-${view.theme}`;
  const file = `${name}.png`;
  try {
    await page.goto(base + screen.path, { timeout: 180_000 });
    await page.locator(screen.ready).first().waitFor({ timeout: 120_000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await settle(page);
    if (screen.then) {
      await screen.then(page);
      await settle(page);
    }
    await page.mouse.move(view.width - 2, view.height - 2);
    const got = (await page.evaluate(COLLECT)) as Collected;
    await page.screenshot({ path: path.join(dir, file) });
    return {
      screen: screen.id,
      view,
      file,
      controls: got.controls,
      overlaps: overlaps(got.controls),
      spills: spilling(got.controls),
      crowded: crowdedTexts(got.controls),
      past: pastTheEdge(got.controls, view.width),
      small: smallTargets(got.controls),
      cut: got.cut.filter((c) => isCutWithoutEllipsis(c.box)),
      pageWider: Math.max(0, got.scrollWidth - got.innerWidth),
    };
  } catch (e) {
    return { screen: screen.id, view, file: "", controls: [], overlaps: [], spills: [], crowded: [], past: [], small: [], cut: [], pageWider: 0, error: e instanceof Error ? e.message.split("\n")[0] : String(e) };
  }
}

// ---------- the report ----------
const viewName = (v: View) => `${v.width} ${v.theme}`;

function kindTable(counts: readonly KindCount[]): string[] {
  return ["| Kind | Count | Example |", "| --- | --- | --- |", ...counts.map((k) => `| ${k.key} | ${k.count} | ${k.example.replace(/\|/g, "\\|")} |`)];
}

function report(results: readonly Result[], label: string, started: Date): string {
  const all = results.flatMap((r) => r.controls);
  const lines: string[] = [];
  lines.push(`# UI check: ${label}`, "", `${started.toISOString()}; ${results.length} screen views; the rules: scripts/lib/ui-check-rules.ts.`, "");
  lines.push("## Summary", "", "| Screen | View | Overlaps | Text out of its control | Words run together | Past the edge | Under 24 px (not spaced) | Cut text | Page wider by |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of results)
    lines.push(`| ${r.screen} | ${viewName(r.view)} | ${r.error ? `**error:** ${r.error}` : r.overlaps.length} | ${r.spills.length} | ${r.crowded.length} | ${r.past.length} | ${r.small.length} (${r.small.filter((s) => !s.spaced).length}) | ${r.cut.length} | ${r.pageWider ? `${r.pageWider} px` : "–"} |`);
  lines.push("", "## Kinds over every screen", "", "A control counts once per screen view it shows on.", "");
  for (const [group, ks] of Object.entries(GROUPS)) {
    const counts = kinds(all.filter((c) => ks.includes(c.kind)));
    lines.push(`### ${group}: ${counts.length} kinds`, "", ...kindTable(counts), "");
  }
  lines.push("## Kinds per screen (at 1440 light)", "");
  for (const r of results.filter((x) => x.view.width === 1440 && x.view.theme === "light")) {
    const by = Object.entries(GROUPS).map(([g, ks]) => `${g} ${kinds(r.controls.filter((c) => ks.includes(c.kind))).length}`);
    lines.push(`- **${r.screen}:** ${by.join(", ")}`);
  }
  lines.push("", "## Findings", "");
  for (const r of results) {
    const any = r.overlaps.length || r.spills.length || r.crowded.length || r.past.length || r.small.length || r.cut.length || r.pageWider;
    if (!any) continue;
    lines.push(`### ${r.screen}, ${viewName(r.view)} ([screenshot](${r.file}))`, "");
    for (const o of r.overlaps) lines.push(`- overlap ${o.w} × ${o.h} px: ${describe(o.a)} and ${describe(o.b)}`);
    for (const c of r.spills) lines.push(`- text out of its control by ${Math.round(c.spill)} px: ${describe(c)}`);
    for (const c of r.crowded) lines.push(`- words ${c.gap} px apart: ${describe(c.a)} and ${describe(c.b)}`);
    for (const c of r.past) lines.push(`- past the edge: ${describe(c)} (x ${Math.round(c.visible!.x)} to ${Math.round(c.visible!.x + c.visible!.w)})`);
    for (const s of r.small) lines.push(`- ${Math.round(s.control.rect.w)} × ${Math.round(s.control.rect.h)} px${s.spaced ? " (spaced)" : ""}: ${describe(s.control)}`);
    for (const c of r.cut) lines.push(`- cut: ${c.testId ? `[${c.testId}] ` : ""}${c.tag} "${c.text.slice(0, 60)}" (${c.box.scrollWidth} in ${c.box.clientWidth} px)`);
    if (r.pageWider) lines.push(`- the page is ${r.pageWider} px wider than the screen`);
    lines.push("");
  }
  return lines.join("\n");
}

function compare(a: string, b: string): void {
  const pngs = readdirSync(a).filter((f) => f.endsWith(".png") && existsSync(path.join(b, f))).sort();
  const rel = (d: string) => path.relative(OUT_ROOT, d).replace(/\\/g, "/");
  const count = (d: string) => (JSON.parse(readFileSync(path.join(d, "report.json"), "utf8")) as { kinds: Record<string, number> }).kinds;
  const ka = count(a), kb = count(b);
  const html = `<!doctype html><meta charset="utf-8"><title>UI check: before and after</title>
<style>body{font:13px/1.5 system-ui,sans-serif;margin:16px;background:#fff;color:#18212c}h2{font-size:15px;margin:28px 0 6px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair img{width:100%;border:1px solid #e2e6eb}table{border-collapse:collapse}td,th{padding:2px 10px;border-bottom:1px solid #e2e6eb;text-align:left}</style>
<h1>UI check: ${rel(a)} → ${rel(b)}</h1>
<table><tr><th>Kinds</th><th>Before</th><th>After</th></tr>${Object.keys({ ...ka, ...kb }).map((k) => `<tr><td>${k}</td><td>${ka[k] ?? 0}</td><td>${kb[k] ?? 0}</td></tr>`).join("")}</table>
${pngs.map((f) => `<h2>${f.replace(/\.png$/, "").replace("--", " · ")}</h2><div class="pair"><img src="${rel(a)}/${f}" alt="before"><img src="${rel(b)}/${f}" alt="after"></div>`).join("\n")}`;
  const file = path.join(OUT_ROOT, `compare-${path.basename(a)}--${path.basename(b)}.html`);
  writeFileSync(file, html);
  console.log(`Written ${path.relative(process.cwd(), file)} (${pngs.length} pairs).`);
}

// ---------- main ----------
async function main() {
  const cmp = argv.indexOf("--compare");
  if (cmp >= 0) return compare(path.resolve(argv[cmp + 1]!), path.resolve(argv[cmp + 2]!));

  const label = arg("label") ?? "run";
  if (!/^[\w-]+$/.test(label)) throw new Error("--label takes letters, digits, - and _.");
  const only = list(arg("only"));
  const widths = list(arg("widths"))?.map(Number);
  const themes = list(arg("themes"));
  const views = ALL_VIEWS.filter((v) => (!widths || widths.includes(v.width)) && (!themes || themes.includes(v.theme)));
  const external = arg("url");

  if (REFUSED.includes(DATA.toLowerCase())) throw new Error(`${DATA} is not the check's own data file.`);
  let db: DevDb | undefined;
  await resetDevData(DATA, (d) => {
    addSeedDemoData(d);
    longNames(d, named(d, "workspace", "Retail Co – DWH").id);
    db = d;
  });
  const ids = idsOf(db!);

  const started = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${started.getFullYear()}${two(started.getMonth() + 1)}${two(started.getDate())}-${two(started.getHours())}${two(started.getMinutes())}`;
  const dir = path.join(OUT_ROOT, `${label}-${stamp}`);
  mkdirSync(dir, { recursive: true });

  const server = external ? null : await startServer();
  const base = external ?? `http://${HOST}:${PORT}`;
  let browser: Browser | null = null;
  const results: Result[] = [];
  try {
    browser = await chromium.launch();
    for (const view of views) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, colorScheme: "light", locale: "en-GB", timezoneId: "Europe/Warsaw" });
      await context.addCookies([{ name: "im-theme", value: view.theme, url: base + "/" }]);
      const page = await signIn(context, base);
      // the tabs the pages show (the workspace home's and the left panel's), read once per view
      await page.goto(`${base}/w/${ids.ws}`);
      await page.getByTestId("page-workspace-home").waitFor();
      const wsTabs = (await page.locator('[role="tablist"] [role="tab"]').evaluateAll((els) => els.map((e) => new URL((e as HTMLAnchorElement).href, location.href).searchParams.get("tab")))).filter((t): t is string => !!t);
      await page.goto(`${base}/w/${ids.ws}/p/${ids.project}/c/${ids.canvas}`);
      await page.locator(".react-flow__node").first().waitFor({ timeout: 120_000 });
      const leftTabs = await page.locator('[data-testid="panel-left"] [role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? "").filter(Boolean));
      for (const screen of screens(ids, wsTabs, leftTabs)) {
        if (only && !only.some((o) => screen.id.startsWith(o))) continue;
        if (screen.minWidth && view.width < screen.minWidth) continue;
        const r = await check(page, base, screen, view, dir);
        results.push(r);
        console.log(`${r.screen} ${viewName(view)}: ${r.error ? `error: ${r.error}` : `${r.controls.length} controls, ${r.overlaps.length} overlaps, ${r.spills.length} spill, ${r.crowded.length} crowded, ${r.past.length} past, ${r.small.length} small, ${r.cut.length} cut`}`);
      }
      await context.close();
    }
  } finally {
    await browser?.close();
    if (server) stopServer(server);
  }
  const all = results.flatMap((r) => r.controls);
  const kindCounts = Object.fromEntries(Object.entries(GROUPS).map(([g, ks]) => [g, kinds(all.filter((c) => ks.includes(c.kind))).length]));
  writeFileSync(path.join(dir, "report.md"), report(results, label, started));
  writeFileSync(path.join(dir, "report.json"), JSON.stringify({ label, started, kinds: kindCounts, results: results.map(({ controls, ...r }) => ({ ...r, controls: controls.length, kinds: kinds(controls) })) }, null, 1));
  console.log(`\nKinds: ${Object.entries(kindCounts).map(([g, n]) => `${g} ${n}`).join(", ")}`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(dir, "report.md"))}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
