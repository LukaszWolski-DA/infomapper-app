"use client";

// InfoCatalog's search page (slice 39, S39-03; the prototype's layout B, iteration 5): one calm centred column (at most
// 1,100 px) under the platform's bar (the apps button, "InfoCatalog", the organization or its select, the account). One
// search field ("/" puts the cursor in it), the scope, the kind tabs with counts ("All" first; a kind with no result
// disabled; a module's tabs only where it is on), the results as a plain table, the first 200 and "{n} more: narrow the
// search"; an empty field shows example searches and "Browse all …". The state is in the address (C7): the page's first
// answer comes from the server, then each change asks the server again (`search`, C1), 150 ms after the last keystroke,
// an older answer dropped. Read only: nothing here writes.
//
// Step 6 (S39-04): a click on a result (or Enter) opens its details in the drawer (`item-drawer.tsx`, the shared
// `Drawer`); from 1,100 px the column moves left and the results stay clickable. ↑ ↓ (or j k) move through the results
// and the drawer follows; Esc closes it. An item's own address is the catalog's with `item=` (C7); a connected item opens
// in the same drawer and "← Back" returns. The way back from InfoMapper ends when the catalog opens again.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PlatformBar, type PlatformUser } from "@/app/_components/platform-bar";
import type { CatalogLink } from "@/domain/catalog/details";
import type { TextRange } from "@/domain/catalog/match";
import type { CatalogOrganization } from "@/domain/permissions";
import { dropCatalogReturn } from "@/ui/catalog-return";
import { chipVariants, filterChipVariants } from "@/ui/components/chip";
import { Drawer, DRAWER_ROOM } from "@/ui/components/drawer";
import { useToast } from "@/ui/components/toast";
import { Input } from "@/ui/components/input";
import { Select } from "@/ui/components/select";
import { TAB_COUNT, tabsListVariants, tabVariants } from "@/ui/components/tabs";
import { cn } from "@/ui/lib/utils";
import { addressOf } from "../domain/address";
import { itemRefText, type CatalogItemView } from "../domain/item";
import { ALL_TAB } from "../domain/search";
import { scopeOptions, type CatalogRowView, type CatalogState, type CatalogView } from "../domain/view";
import { ItemDrawer } from "./item-drawer";

export const SEARCH_PLACEHOLDER = "Search entities, attributes, sources, mappings, requirements, relationships…";
export const EXAMPLE_SEARCHES = ["customer", "personal data", "cust_no", "email", "REQ-102", "order status"] as const;
const DEBOUNCE_MS = 150;

export interface CatalogPageProps {
  user: PlatformUser;
  organization: CatalogOrganization;
  /** Every organization whose catalog the person reads (the select, when more than one). */
  organizations: readonly { id: string; name: string }[];
  view: CatalogView;
  search: (state: CatalogState) => Promise<{ ok: true; view: CatalogView } | { ok: false }>;
  /** The item its address opens (step 6), or none. */
  item: CatalogItemView | null;
  openItem: (org: string, ref: string) => Promise<{ ok: true; item: CatalogItemView } | { ok: false }>;
}

const NOT_IN_CATALOG = "That item is not in InfoCatalog.";
const rowRef = (r: CatalogRowView) => itemRefText({ kind: r.kind, workspaceId: r.workspaceId, id: r.id });
const inTextField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && typeof el.closest === "function" && (!!el.closest("input, textarea, select, [contenteditable='true']") || el.isContentEditable);
};

export function CatalogPage({ user, organization, organizations, view: first, search, item: firstItem, openItem }: CatalogPageProps) {
  const [view, setView] = useState(first);
  const [q, setQ] = useState(first.state.q);
  const asked = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const toast = useToast();
  // the drawer: the item shown, the ones "← Back" returns to, the reference asked for last (an older answer is dropped)
  const [item, setItem] = useState<CatalogItemView | null>(firstItem);
  const [trail, setTrail] = useState<readonly CatalogItemView[]>([]);
  const [busy, setBusy] = useState(false);
  const itemNow = useRef<string | null>(firstItem?.ref ?? null);
  const itemAsked = useRef(0);
  const stateNow = useRef({ state: first.state, q: first.state.q });
  useEffect(() => {
    stateNow.current = { state: view.state, q };
  }, [view.state, q]);

  /** The address of what the page shows now: the search, and the item in the drawer. */
  const addressNow = useCallback(() => addressOf({ ...stateNow.current.state, q: stateNow.current.q, item: itemNow.current }), []);

  const ask = (state: CatalogState) => {
    const n = ++asked.current;
    stateNow.current = { state, q: state.q };
    window.history.replaceState(null, "", addressOf({ ...state, item: itemNow.current }));
    void search(state).then((r) => {
      if (n === asked.current && r.ok) setView(r.view);
    });
  };

  const close = useCallback(() => {
    itemAsked.current++;
    itemNow.current = null;
    setItem(null);
    setTrail([]);
    setBusy(false);
    window.history.replaceState(null, "", addressNow());
  }, [addressNow]);

  /** Opens an item in the drawer; `back`: the items "← Back" then returns to. */
  const show = useCallback(
    (ref: string, back: readonly CatalogItemView[]) => {
      const n = ++itemAsked.current;
      itemNow.current = ref;
      setBusy(true);
      window.history.replaceState(null, "", addressNow());
      void openItem(organization.id, ref).then((r) => {
        if (n !== itemAsked.current) return;
        if (!r.ok) {
          toast(NOT_IN_CATALOG);
          close();
          return;
        }
        setBusy(false);
        setItem(r.item);
        setTrail(back);
      });
    },
    [addressNow, openItem, organization.id, toast, close],
  );
  const openRow = useCallback((r: CatalogRowView) => show(rowRef(r), []), [show]);
  const openLink = (l: CatalogLink) => {
    if (item) show(itemRefText({ kind: l.ref.kind, workspaceId: item.workspaceId, id: l.ref.id }), [...trail, item]);
  };
  const goBack = () => {
    const last = trail.at(-1);
    if (!last) return;
    itemAsked.current++;
    itemNow.current = last.ref;
    setItem(last);
    setTrail(trail.slice(0, -1));
    setBusy(false);
    window.history.replaceState(null, "", addressNow());
  };

  // the catalog is open again: InfoMapper's way back to it ends (C7)
  useEffect(() => dropCatalogReturn(window.sessionStorage), []);

  // Esc closes the drawer; ↑ ↓ (or j k) move through the results and the drawer follows (outside a text field)
  const rows = view.rows;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || inTextField(e.target)) return;
      if (e.key === "Escape" && itemNow.current) {
        e.preventDefault();
        close();
        return;
      }
      const step = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
      if (!step || !itemNow.current || !rows.length) return;
      e.preventDefault();
      const at = rows.findIndex((r) => rowRef(r) === itemNow.current);
      const next = rows[at < 0 ? (step > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, at + step))]!;
      if (rowRef(next) === itemNow.current) return;
      openRow(next);
      const el = document.querySelector<HTMLElement>(`[data-testid="row-catalog-result"][data-ref="${CSS.escape(rowRef(next))}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, close, openRow]);
  const change = (patch: Partial<CatalogState>) => {
    if (timer.current) clearTimeout(timer.current);
    ask({ ...view.state, q, ...patch });
  };
  const type = (text: string) => {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => ask({ ...view.state, q: text }), DEBOUNCE_MS);
  };
  const example = (text: string) => {
    setQ(text);
    change({ q: text });
    field.current?.focus();
  };

  // "/" puts the cursor in the field, outside a text field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable='true']") || t.isContentEditable)) return;
      e.preventDefault();
      field.current?.focus();
      field.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const { state } = view;
  const browsing = !state.q.trim();
  const many = organizations.length > 1;
  return (
    <div className="flex min-h-dvh flex-col bg-im-surface">
      <PlatformBar
        title={
          <>
            InfoCatalog
            {!many && <small className="ml-1.5 text-xs font-normal text-im-ink-3">{organization.name}</small>}
          </>
        }
        user={user}
      >
        {many && (
          <Select
            size="bar"
            aria-label="Organization"
            data-testid="select-catalog-organization"
            className="w-auto max-w-[240px] max-[601px]:max-w-[110px]"
            value={organization.id}
            onChange={(e) => window.location.assign(addressOf({ org: e.currentTarget.value, q: "", scope: null, kind: ALL_TAB, item: null }))}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
      </PlatformBar>
      <main data-testid="page-catalog" data-organization={organization.id} data-query={state.q} data-kind={state.kind} data-scope={state.scope ?? ""} data-item={item?.ref ?? ""} className={cn("mx-auto w-full max-w-[1100px] px-6 pb-16 pt-9 max-[601px]:px-4", item && DRAWER_ROOM)}>
        <div className="relative">
          <svg viewBox="0 0 18 18" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 fill-none stroke-im-ink-3 stroke-[1.6]" aria-hidden>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M12 12l4 4" />
          </svg>
          <Input
            ref={field}
            size="search"
            type="search"
            data-testid="input-catalog-search"
            aria-label="Search the catalog"
            placeholder={SEARCH_PLACEHOLDER}
            autoComplete="off"
            value={q}
            onChange={(e) => type(e.currentTarget.value)}
          />
        </div>
        <div className="flex min-h-[30px] flex-wrap items-center gap-2.5 pt-3">
          <span className="flex-1" />
          <Select
            size="sm"
            aria-label="Where to search"
            data-testid="select-catalog-scope"
            className="w-auto max-w-[320px]"
            value={state.scope ?? ""}
            onChange={(e) => change({ scope: e.currentTarget.value || null })}
          >
            {scopeOptions(organization).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div role="tablist" aria-label="Kinds" data-testid="tabs-catalog-kinds" className={cn(tabsListVariants({ density: "panel" }), "mt-3 flex-wrap gap-x-3.5 border-b border-im-line max-[600px]:flex-nowrap")}>
          {view.tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              data-testid="tab-catalog-kind"
              data-kind={t.key}
              aria-selected={state.kind === t.key}
              disabled={t.key !== ALL_TAB && t.key !== state.kind && t.count === 0}
              onClick={() => change({ kind: state.kind === t.key && t.key !== ALL_TAB ? ALL_TAB : t.key })}
              className={cn(tabVariants({ density: "panel" }), "disabled:cursor-default disabled:opacity-45 disabled:hover:text-im-ink-3")}
            >
              {t.label}
              <span className={TAB_COUNT}>{t.count.toLocaleString("en")}</span>
            </button>
          ))}
        </div>
        <div className="pt-4">
          {browsing && state.kind === ALL_TAB ? (
            <EmptyState view={view} onExample={example} onBrowse={(kind) => change({ kind })} />
          ) : view.rows.length === 0 ? (
            <Nothing view={view} organization={organization.name} />
          ) : (
            <Results view={view} current={item ? item.ref : null} onOpen={openRow} />
          )}
        </div>
      </main>
      {item && (
        <Drawer label="Details" onClose={close} testId="drawer-catalog">
          <ItemDrawer item={item} catalogPath={addressNow} canGoBack={trail.length > 0} busy={busy} onBack={goBack} onClose={close} onOpen={openLink} />
        </Drawer>
      )}
    </div>
  );
}

function Box({ testId, title, children }: { testId: string; title: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-dashed border-im-line bg-im-surface p-[22px] text-im-ink-2">
      <h3 className="m-0 mb-1.5 text-[15px] font-semibold text-im-ink">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ view, onExample, onBrowse }: { view: CatalogView; onExample: (q: string) => void; onBrowse: (kind: string) => void }) {
  return (
    <Box testId="box-catalog-empty" title="What are you looking for?">
      Type a name, a word from a definition or a classification. Or browse everything of one kind.
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {EXAMPLE_SEARCHES.map((t) => (
          <button key={t} type="button" data-testid="button-catalog-example" className={filterChipVariants()} onClick={() => onExample(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
        {view.tabs
          .filter((t) => t.key !== ALL_TAB && t.count > 0)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              data-testid="button-catalog-browse"
              data-kind={t.key}
              title={`Browse all ${t.label.toLowerCase()}`}
              className={cn(filterChipVariants(), "h-auto min-h-target flex-col items-start gap-0 whitespace-normal rounded-md px-3 py-2 text-left")}
              onClick={() => onBrowse(t.key)}
            >
              <b className="text-[16px] font-semibold text-im-ink">{t.count.toLocaleString("en")}</b>
              <span>Browse all {t.label.toLowerCase()}</span>
            </button>
          ))}
      </div>
    </Box>
  );
}

function Nothing({ view, organization }: { view: CatalogView; organization: string }) {
  const tab = view.tabs.find((t) => t.key === view.state.kind);
  const what = view.state.kind === ALL_TAB ? "items" : (tab?.label ?? "items").toLowerCase();
  const q = view.state.q.trim();
  return (
    <Box testId="box-catalog-nothing" title="Nothing found">
      No {what}
      {q ? ` match “${q}”` : " found"} in {view.state.scope ? "this workspace" : organization}. Check the spelling, or search the whole organization.
    </Box>
  );
}

const COLUMNS = "grid-cols-[minmax(0,2.3fr)_108px_minmax(0,1.3fr)_minmax(0,1.5fr)]";
const COLUMNS_MANY = "grid-cols-[minmax(0,2.1fr)_108px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)]";

function Results({ view, current, onOpen }: { view: CatalogView; current: string | null; onOpen: (r: CatalogRowView) => void }) {
  const cols = view.many ? COLUMNS_MANY : COLUMNS;
  return (
    <>
      <div data-testid="text-catalog-summary" className="px-0.5 pb-1 text-xs text-im-ink-3">
        {view.total.toLocaleString("en")} result{view.total === 1 ? "" : "s"}
      </div>
      <div role="table" aria-label="Results" data-testid="table-catalog-results" className="flex flex-col">
        <div role="row" className={cn("grid items-baseline gap-x-4 border-b border-im-line px-2.5 py-1.5 text-[11.5px] text-im-ink-3 max-[900px]:hidden", cols)}>
          <span role="columnheader">Item</span>
          <span role="columnheader">Kind</span>
          <span role="columnheader">Details</span>
          {view.many && <span role="columnheader">Workspace</span>}
          <span role="columnheader">Marks</span>
        </div>
        {view.rows.map((r) => (
          <Row key={r.key} row={r} cols={cols} many={view.many} current={current === rowRef(r)} onOpen={onOpen} />
        ))}
      </div>
      {view.more > 0 && (
        <p data-testid="text-catalog-more" className="m-0 px-2.5 pt-3 text-[12.5px] text-im-ink-3">
          {view.more.toLocaleString("en")} more: narrow the search
        </p>
      )}
    </>
  );
}

function Row({ row, cols, many, current, onOpen }: { row: CatalogRowView; cols: string; many: boolean; current: boolean; onOpen: (r: CatalogRowView) => void }) {
  return (
    <div
      role="row"
      tabIndex={0}
      aria-current={current || undefined}
      data-testid="row-catalog-result"
      data-kind={row.kind}
      data-id={row.id}
      data-workspace={row.workspaceId}
      data-ref={rowRef(row)}
      onClick={() => onOpen(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen(row);
        }
      }}
      className={cn(
        "grid cursor-pointer items-baseline gap-x-4 rounded-md border-b border-im-line/70 px-2.5 py-3 outline-none hover:bg-im-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-im-logical max-[900px]:grid-cols-1 max-[900px]:gap-y-1",
        current && "bg-im-logical-soft hover:bg-im-logical-soft",
        cols,
      )}
    >
      <span role="cell" className="min-w-0 font-medium [overflow-wrap:anywhere]">
        <span data-testid="text-result-name">
          <Marked text={row.name} ranges={row.nameRanges} />
        </span>
        {row.definition && (
          <small data-testid="text-result-definition" className="mt-0.5 block truncate text-[12.5px] font-normal text-im-ink-3" title={row.definition.text}>
            <Marked text={row.definition.text} ranges={row.definition.ranges} />
          </small>
        )}
      </span>
      <span role="cell" data-testid="text-result-kind" className="text-[11px] uppercase tracking-[.05em] text-im-ink-3">
        {row.kindLabel}
      </span>
      <span role="cell" data-testid="text-result-path" className="min-w-0 text-[12.5px] text-im-ink-2 [overflow-wrap:anywhere]">
        <Marked text={row.path} ranges={row.pathRanges} />
      </span>
      {many && (
        <span role="cell" data-testid="text-result-workspace" className="min-w-0 text-[12.5px] text-im-ink-2 [overflow-wrap:anywhere]">
          {row.workspace}
        </span>
      )}
      <span role="cell" data-testid="text-result-marks" className="flex flex-wrap gap-1">
        {row.marks.map((m) => (
          <span key={m.text} className={chipVariants({ tone: m.tone === "pii" ? "pii" : "neutral" })}>
            {m.text}
          </span>
        ))}
      </span>
    </div>
  );
}

/** A text with its matches highlighted (`<mark>`), from the domain's ranges; never HTML from the text. */
function Marked({ text, ranges }: { text: string; ranges: readonly TextRange[] }) {
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) out.push(text.slice(at, start));
    out.push(
      <mark key={start} className="rounded-[2px] bg-[#FFE9A8] text-inherit dark:bg-[#5A4A14]">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}
