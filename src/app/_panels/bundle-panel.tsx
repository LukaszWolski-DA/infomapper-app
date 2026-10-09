"use client";

// The bundle panel (slice 2c, item 7; prototype insBundle): what a bundled line at a collapsed frame holds. Mappings:
// how many, from which end to which, the counts by status, each mapping as a link grouped by the entity it fills, and
// an “Expand {frame}” button per collapsed end. Relationships: how many, between which ends, each with its
// multiplicities as a link, and the same buttons.

import { useContext, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { multText } from "@/canvas/geometry";
import type { Bundle, BundleEnd } from "@/canvas/line-geometry";
import type { Mapping } from "@/domain/types";
import { Actions, buttonClass, Kind, Li, List, TypeDot } from "./fields";
import { usePanel } from "./inspector";
import { attributeLabel, columnLabel, inputsLabel, typeCheckOf } from "./model-index";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function BundlePanel({ bundle: b, entityName }: { bundle: Bundle; entityName: (cardId: string) => string }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { ix } = p;
  const frameName = (frameId: string) => ui.frameView(frameId)?.frame.name ?? "?";
  /** A collapsed frame by its name; a mapping's other end by its column (from) or attribute (to); an entity by name. */
  const endName = (e: BundleEnd, from: boolean): ReactNode => {
    if ("frameId" in e)
      return (
        <>
          <b>{frameName(e.frameId)}</b> (collapsed frame)
        </>
      );
    const label = "rowId" in e ? (from ? columnLabel(ix, e.rowId) : attributeLabel(ix, e.rowId)) : entityName(e.cardId);
    return <span className="font-mono text-[12px]">{label}</span>;
  };
  const collapsedEnds = [b.a, b.z].filter((e): e is Extract<BundleEnd, { frameId: string }> => "frameId" in e);
  const expand = (
    <Actions>
      {collapsedEnds.map((e) => (
        <button key={e.frameId} type="button" className={buttonClass} onClick={() => ui.setFrameCollapsed(e.frameId, false)} data-testid="button-bundle-expand">
          Expand {frameName(e.frameId)}
        </button>
      ))}
    </Actions>
  );

  if (b.t === "rel") {
    const rels = b.ids.map((id) => ix.model.relationships.find((r) => r.id === id)).filter((r) => r !== undefined);
    return (
      <div data-testid="panel-bundle">
        <Kind>Bundled relationships</Kind>
        <h2 className="text-base font-semibold leading-snug">{plural(rels.length, "relationship")}</h2>
        <p className="mt-2">
          Between {endName(b.a, true)} and {endName(b.z, false)}.
        </p>
        <h3 className="mb-1 mt-4 text-[11.5px] font-semibold uppercase tracking-wide text-im-ink-3">In this bundle</h3>
        <List testId="list-bundle-relationships">
          {rels.map((r) => (
            <Li key={r.id} onClick={() => ui.select({ t: "rel", id: r.id })} meta={`${multText(r.from_min, r.from_max)} : ${multText(r.to_min, r.to_max)}`} testId="item-bundle-relationship">
              {ix.entity.get(r.from_entity_id)?.name ?? "?"} {r.label || "relates to"} {ix.entity.get(r.to_entity_id)?.name ?? "?"}
            </Li>
          ))}
        </List>
        {expand}
      </div>
    );
  }

  const maps = b.ids.map((id) => ix.mapping.get(id)).filter((m): m is Mapping => m !== undefined);
  const count = (s: Mapping["status"]) => maps.filter((m) => m.status === s).length;
  const warn = maps.filter((m) => !typeCheckOf(ix, m).ok).length;
  const byEntity = new Map<string, Mapping[]>();
  for (const m of maps) {
    const e = ix.attribute.get(m.attribute_id)?.entity_id ?? "";
    byEntity.set(e, [...(byEntity.get(e) ?? []), m]);
  }
  return (
    <div data-testid="panel-bundle">
      <Kind>Bundled mappings</Kind>
      <h2 className="text-base font-semibold leading-snug">{plural(maps.length, "mapping")}</h2>
      <p className="mt-2">
        From {endName(b.a, true)} to {endName(b.z, false)}.
      </p>
      <p className="mt-2" data-testid="bundle-status-counts">
        {count("approved")} approved, {count("review")} in review, {count("draft")} draft
        {warn ? (
          <>
            , <span className="text-im-warn">{warn} with a type problem</span>
          </>
        ) : null}
        .
      </p>
      {[...byEntity].map(([entityId, list]) => (
        <div key={entityId}>
          <h3 className="mb-1 mt-4 text-[11.5px] font-semibold uppercase tracking-wide text-im-ink-3">Into {ix.entity.get(entityId)?.name ?? "?"}</h3>
          <List testId="list-bundle-mappings">
            {list.map((m) => (
              <Li key={m.id} onClick={() => p.goMapping(m.id)} meta={`→ ${ix.attribute.get(m.attribute_id)?.name ?? "?"}`} testId="item-bundle-mapping">
                <span className="flex min-w-0 items-center gap-2">
                  <TypeDot ok={typeCheckOf(ix, m).ok} />
                  <span className="truncate font-mono text-[12px]">{inputsLabel(ix, m.id)}</span>
                </span>
              </Li>
            ))}
          </List>
        </div>
      ))}
      {expand}
    </div>
  );
}
