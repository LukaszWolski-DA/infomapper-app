"use client";

// An item's details in the drawer (slice 39, S39-04, S39-05; the prototype's `drawDet` in layout B, without lineage,
// impact, Markdown, "Open in a window" and the catalog's own content): the header (kind, name, path, workspace, marks,
// "From InfoMapper · read only"), "Open in InfoMapper" or, without a role, who to ask; the texts; the characteristics;
// the items one step away, each opening in the same drawer ("← Back" returns); the context (the canvases that show it,
// the documents that include it as the reader sees them). Read only.

import Link from "next/link";
import type { ReactNode } from "react";
import { canvasHref, documentHref, workspaceHref } from "@/app/_lib/paths";
import type { CatalogCanvas } from "@/domain/catalog/canvases";
import type { CatalogFact, CatalogLink } from "@/domain/catalog/details";
import { buttonVariants } from "@/ui/components/button";
import { chipVariants } from "@/ui/components/chip";
import { DRAWER_HEADING, DRAWER_INLINE_LINK, DRAWER_LINK } from "@/ui/components/drawer";
import { IconButton } from "@/ui/components/icon-button";
import { keepCatalogReturn } from "@/ui/catalog-return";
import { LocalMinute } from "@/ui/local-minute";
import { cn } from "@/ui/lib/utils";
import { noRoleText, OFF_CANVAS, type CatalogItemView } from "../domain/item";

export const FROM_INFOMAPPER = "From InfoMapper · read only";

/** Where "Open in InfoMapper" goes: a workspace home's tab, the first canvas that shows the item, or the home's notice. */
export function openHref(item: CatalogItemView): string {
  if (item.homeTab) return workspaceHref(item.workspaceId, item.homeTab);
  const first = item.canvases[0];
  if (first) return canvasLinkOf(item.workspaceId, first);
  return `/w/${item.workspaceId}?${new URLSearchParams({ gone: OFF_CANVAS, item: `${item.kind}:${item.id}` }).toString()}`;
}

const canvasLinkOf = (workspaceId: string, c: CatalogCanvas) => `${canvasHref(workspaceId, c.projectId, c.canvasId)}?${new URLSearchParams({ ...c.query, from: "catalog" }).toString()}`;

export interface ItemDrawerProps {
  item: CatalogItemView;
  /** The catalog's address now: where "← Back to InfoCatalog" returns. */
  catalogPath: () => string;
  canGoBack: boolean;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  onOpen: (link: CatalogLink) => void;
}

export function ItemDrawer({ item, catalogPath, canGoBack, busy, onBack, onClose, onOpen }: ItemDrawerProps) {
  const leave = () => keepCatalogReturn(window.sessionStorage, { path: catalogPath(), workspaceId: item.workspaceId });
  const { details } = item;
  return (
    <div data-testid="details-catalog-item" data-item={item.ref} data-kind={item.kind} aria-busy={busy || undefined} className={cn(busy && "opacity-60")}>
      <div className="-mr-2 mb-2.5 flex items-center gap-1.5">
        <span className="flex-1 text-xs text-im-ink-3">↑ ↓ next item · Esc closes</span>
        {canGoBack && (
          <button type="button" data-testid="button-drawer-back" className={buttonVariants({ variant: "quiet", size: "sm" })} onClick={onBack}>
            ← Back
          </button>
        )}
        <IconButton label="Close the details" title="Close (Esc)" data-testid="button-drawer-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" className="fill-none stroke-current stroke-[1.6]" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </IconButton>
      </div>
      <span data-testid="text-drawer-kind" className="text-[11px] font-semibold uppercase tracking-[.05em] text-im-ink-3">
        {item.kindLabel}
      </span>
      <h2 data-testid="text-drawer-name" className="m-0 mb-0.5 mt-1.5 text-[18px] font-semibold leading-snug [overflow-wrap:anywhere] [text-wrap:balance]">
        {item.name}
      </h2>
      {item.path && (
        <div data-testid="text-drawer-path" className="text-[12.5px] text-im-ink-2 [overflow-wrap:anywhere]">
          {item.path}
        </div>
      )}
      <div className="mt-0.5 text-xs text-im-ink-3">
        <span data-testid="text-drawer-workspace">
          {item.workspace.name}
          {item.workspace.archived ? " (archived)" : ""}
        </span>{" "}
        · <span data-testid="text-drawer-source">{FROM_INFOMAPPER}</span>
      </div>
      {item.marks.length > 0 && (
        <div data-testid="text-drawer-marks" className="mt-2 flex flex-wrap gap-1">
          {item.marks.map((m) => (
            <span key={m.text} className={chipVariants({ tone: m.tone === "pii" ? "pii" : "neutral" })}>
              {m.text}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3.5">
        {item.workspace.hasRole ? (
          <Link href={openHref(item)} data-testid="button-open-in-infomapper" onClick={leave} className={cn(buttonVariants({ variant: "primary" }), "inline-flex items-center px-3.5")}>
            Open in InfoMapper
          </Link>
        ) : (
          <p data-testid="text-drawer-no-role" className="m-0 rounded-md bg-im-panel px-3 py-2 text-[12.5px] text-im-ink-2">
            {noRoleText(item.workspace.name, item.owners)}
          </p>
        )}
      </div>

      {details.texts.map((t) => (
        <Section key={t.title} title={t.title} testId="section-drawer-text">
          <p className={cn("m-0 whitespace-pre-wrap text-im-ink-2 [overflow-wrap:anywhere]", t.mono && "font-mono text-[12.5px]")}>{t.text}</p>
        </Section>
      ))}

      {details.facts.length > 0 && (
        <Section title="Characteristics" note="from InfoMapper" testId="section-drawer-facts">
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-1 text-body">
            {details.facts.map((f) => (
              <Fact key={f.label} fact={f} onOpen={onOpen} />
            ))}
          </dl>
        </Section>
      )}

      {details.groups.map((g) => (
        <Section key={g.title} title={g.title} testId="section-drawer-group">
          <div className="flex flex-col gap-1">
            {g.links.map((l) => (
              <button key={`${l.ref.kind}:${l.ref.id}`} type="button" data-testid="button-drawer-link" data-kind={l.ref.kind} data-id={l.ref.id} className={DRAWER_LINK} onClick={() => onOpen(l)}>
                <span className="min-w-0 [overflow-wrap:anywhere]">{l.name}</span>
                {l.note && <span className="flex-none text-xs text-im-ink-3">{l.note}</span>}
              </button>
            ))}
          </div>
          {g.more > 0 && <p className="m-0 mt-1.5 text-xs text-im-ink-3">and {g.more.toLocaleString("en")} more</p>}
        </Section>
      ))}

      {(item.canvases.length > 0 || item.documents.length > 0) && (
        <Section title="Context" testId="section-drawer-context">
          {item.canvases.length > 0 && (
            <>
              <h5 className="m-0 mb-1 text-xs font-medium text-im-ink-2">Canvases that show it</h5>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {item.canvases.map((c) => (
                  <li key={`${c.projectId}:${c.canvasId}`}>
                    {item.workspace.hasRole ? (
                      <Link href={canvasLinkOf(item.workspaceId, c)} data-testid="link-drawer-canvas" onClick={leave} className={DRAWER_LINK}>
                        <CanvasName c={c} />
                      </Link>
                    ) : (
                      <span data-testid="link-drawer-canvas" className="flex min-h-target items-center justify-between gap-2 px-[9px] text-body">
                        <CanvasName c={c} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {item.documents.length > 0 && (
            <>
              <h5 className="m-0 mb-1 mt-3 text-xs font-medium text-im-ink-2">Documents that include it</h5>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {item.documents.map((d) => (
                  <li key={d.id}>
                    <Link href={documentHref(item.workspaceId, d.id)} data-testid="link-drawer-document" onClick={leave} className={DRAWER_LINK}>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{d.name}</span>
                      <span className="flex-none text-xs text-im-ink-3">{d.shared ? "Shared" : "Private, yours"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function CanvasName({ c }: { c: CatalogCanvas }) {
  return (
    <>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className="text-im-ink-3">{c.projectName} › </span>
        {c.canvasName}
      </span>
      {!c.whole && <span className="flex-none text-xs text-im-ink-3">in part</span>}
    </>
  );
}

function Section({ title, note, testId, children }: { title: string; note?: string; testId?: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="mt-[18px]">
      <h4 className={DRAWER_HEADING}>
        {title}
        {note && <span className="font-medium normal-case tracking-normal">{note}</span>}
      </h4>
      {children}
    </section>
  );
}

function Fact({ fact, onOpen }: { fact: CatalogFact; onOpen: (link: CatalogLink) => void }) {
  return (
    <>
      <dt className="text-im-ink-3">{fact.label}</dt>
      <dd data-testid="text-drawer-fact" data-label={fact.label} className={cn("m-0 [overflow-wrap:anywhere]", fact.mono && "font-mono text-[12.5px]")}>
        {fact.links?.length ? (
          <span className="inline-flex flex-wrap gap-1">
            {fact.links.map((l) => (
              <button key={`${l.ref.kind}:${l.ref.id}`} type="button" data-testid="button-drawer-link" data-kind={l.ref.kind} data-id={l.ref.id} className={DRAWER_INLINE_LINK} onClick={() => onOpen(l)}>
                {l.name}
              </button>
            ))}
          </span>
        ) : (
          fact.text
        )}
        {fact.time && (
          <>
            {fact.text ? ", " : ""}
            <LocalMinute iso={fact.time} />
          </>
        )}
        {fact.note && <span className="text-im-ink-3"> {fact.note}</span>}
      </dd>
    </>
  );
}
