"use client";

// An attribute's dimensional mappings in its panel (slice 15c, B-4, C10; prototype `cubeAttrSection`), where InfoMapper
// shows its source sections: a dimensional attribute's "Comes from the logical model" (one row per mapping with its
// inputs, or "Not fed yet…", then "Add a logical attribute"), in place of InfoMapper's "Comes from"; a logical
// attribute's "Feeds facts and dimensions" (one row per mapping with its target), after InfoMapper's "Comes from" and
// only when it feeds something. A row's click selects the mapping; the create is a module command.

import { useContext, useMemo } from "react";
import { useAction } from "@/app/_components/use-action";
import { Field, Fold, GroupedSelect, Hint, Li, LongList, TypeDot } from "@/app/_panels/fields";
import { usePanel } from "@/app/_panels/inspector";
import { CanvasUiCtx } from "@/canvas/context";
import type { Attribute, Entity } from "@/domain/types";
import { CUBE_MAPPING_KIND } from "../canvas/lines";
import { fedFrom, fedFromConcepts, feedsOf, typesDiffer, type FeedRow, type MappingIndex } from "../domain/mappings";
import { createCubeMappingAction } from "./actions";
import { useMappingIndex } from "./canvas-ext";
import { attributeGroups, CUBE_STATUS_LABEL } from "./mapping-panel";

/** The prototype's `statusDot`: a direct copy whose types differ is marked. */
const typesOk = (index: MappingIndex, row: FeedRow) => {
  const m = index.mapping(row.mappingId);
  if (!m || m.kind !== "direct") return true;
  const target = index.attribute(m.attribute_id);
  return !index.inputsOf(m.id).some((i) => typesDiffer(index.attribute(i.attribute_id), target));
};

function FeedList({ rows, index, testId }: { rows: FeedRow[]; index: MappingIndex; testId: string }) {
  const ui = useContext(CanvasUiCtx);
  return (
    <LongList
      items={rows}
      testId={testId}
      text={(r) => r.label}
      render={(r) => (
        <Li key={r.mappingId} onClick={() => ui.select({ t: "ext", kind: CUBE_MAPPING_KIND, id: r.mappingId })} meta={`${r.transform ? "ƒ " : ""}${CUBE_STATUS_LABEL[r.status]}`} testId="item-cube-feed">
          <span className="flex items-center gap-2">
            <TypeDot ok={typesOk(index, r)} />
            <span className="truncate font-mono text-xs">{r.label}</span>
          </span>
        </Li>
      )}
    />
  );
}

export function CubeAttributeFeeds({ attribute: a }: { attribute: Attribute }) {
  const p = usePanel();
  const index = useMappingIndex(p.ix.model);
  const level = index.levelOf(a.id);
  if (level === "dimensional") return <ComesFrom a={a} index={index} />;
  const rows = level === "logical" ? feedsOf(index, a.id) : [];
  if (!rows.length) return null;
  return (
    <Fold title="Feeds facts and dimensions" count={rows.length} testId="fold-cube-feeds">
      <FeedList rows={rows} index={index} testId="list-cube-feeds" />
    </Fold>
  );
}

function ComesFrom({ a, index }: { a: Attribute; index: MappingIndex }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const rows = fedFrom(index, a.id);
  const groups = useMemo(() => attributeGroups(index, p, "logical"), [index, p]);

  async function add(inputAttributeId: string) {
    const result = await run(() => createCubeMappingAction(p.workspaceId, { inputAttributeId, targetAttributeId: a.id }), (v) => v.toast, { undoable: true });
    if (result.ok) ui.select({ t: "ext", kind: CUBE_MAPPING_KIND, id: result.value.mappingId });
  }

  return (
    <Fold title="Comes from the logical model" count={rows.length} testId="fold-cube-comes-from">
      {rows.length ? <FeedList rows={rows} index={index} testId="list-cube-comes-from" /> : <Hint>Not fed yet. Drag a logical attribute onto this row, or pick one below.</Hint>}
      {p.editable && (
        <Field label="Add a logical attribute" htmlFor="f-addla">
          <GroupedSelect id="f-addla" placeholder="Choose an attribute…" groups={groups} onPick={(id) => void add(id)} testId="select-add-logical-attribute" />
        </Field>
      )}
    </Fold>
  );
}

/** "From Order Line and Sales Order (mappings in any status)"; three or more: "From A, B and C (…)" (Łukasz, step 2). */
export function fedFromTitle(entities: readonly string[]): string {
  const names = entities.length > 1 ? `${entities.slice(0, -1).join(", ")} and ${entities[entities.length - 1]}` : (entities[0] ?? "");
  return `From ${names} (mappings in any status)`;
}

const attributesWord = (n: number) => `${n} attribute${n === 1 ? "" : "s"}`;

/**
 * "Fed from concepts" (slice 15d, D14, D-70): a fact's or a dimension's panel, where a logical entity has "Feeding
 * sources": the concepts of the logical entities whose attributes feed its attributes, any status, each with how many of
 * its attributes they feed, in the concepts' order. Rows are not clickable (no concept selection).
 */
export function CubeEntityFeeds({ entity }: { entity: Entity }) {
  const p = usePanel();
  const index = useMappingIndex(p.ix.model);
  const model = p.ix.model;
  const rows = useMemo(() => {
    if (index.entity(entity.id)?.model_level !== "dimensional") return null;
    const conceptOf = new Map(model.entities.map((e) => [e.id, e.concept_id]));
    const order = [...model.concepts].filter((c) => c.deleted_at === null).sort((a, b) => a.sort_order - b.sort_order).map((c) => c.id);
    return fedFromConcepts(index, entity.id, (id) => conceptOf.get(id), order);
  }, [index, entity.id, model]);
  if (!rows) return null;
  const concept = (id: string) => model.concepts.find((c) => c.id === id);
  return (
    <Fold title="Fed from concepts" count={rows.length} testId="fold-cube-fed-from-concepts">
      {rows.length ? (
        <LongList
          items={rows}
          testId="list-cube-fed-from-concepts"
          text={(r) => concept(r.conceptId)?.name ?? ""}
          render={(r) => (
            <div key={r.conceptId} className="flex items-center gap-2 px-2 py-1.5" title={fedFromTitle(r.entities)} data-testid="item-cube-fed-from-concept" data-concept-id={r.conceptId}>
              <i className="size-2 flex-none rounded-[2px]" style={{ background: concept(r.conceptId)?.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{concept(r.conceptId)?.name}</span>
              <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{attributesWord(r.attributes)}</span>
            </div>
          )}
        />
      ) : (
        <Hint>Not fed from the logical model yet.</Hint>
      )}
    </Fold>
  );
}
