"use client";

// InfoCube's sections in InfoMapper's panels (slice 15b, B-4, B-5 with R-4, R-1 to R-6; prototype `cubeEntitySection`,
// `cubeMeasureSection`, `relKeySection`): a fact's grain, measures, dimensions (one row per relationship, with Add key)
// and hints; a dimension's SCD type and "Used by"; a fact's attribute's "Carries" and Measure; a fact – dimension
// relationship's key. InfoMapper's panels render them through the composition root (`src/compose/panels.ts`) and never
// name them. Everything is derived in the browser from the model and InfoCube's rows of the page (`ModuleView.data`);
// every write is a module command on the save chain (slice 9, 10a): grain, SCD and additivity with their row checked,
// a measure turned on with its attribute held, a key's link and Add key with the rows they write held.

import { useContext, useMemo } from "react";
import { useAction } from "@/app/_components/use-action";
import { useModules } from "@/app/_components/modules";
import { Field, fieldKey, Flag, Fold, Hint, inputClass, Li, Note, Seg, smallButtonClass, TextField, useChoice } from "@/app/_panels/fields";
import { usePanel } from "@/app/_panels/inspector";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import type { Attribute, Entity, Relationship } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { asRole, cubeIndex, dimensionAs, factEnds, factHints, NO_HINTS, roleAt, typeWord, usedBy, type CubeIndex, type Hint as CubeHint } from "../domain/keys";
import type { CubeEntity, CubeKey, CubeMeasure, History } from "../domain/types";
import type { CubePageRows } from "../domain/view";
import { addKeyAction, linkKeyAction, setMeasureAction, updateCubeEntityAction, updateMeasureAction } from "./actions";

export const ADDITIVITY_LABEL = { additive: "Additive", semi: "Semi-additive", non: "Non-additive" } as const;
export const ADDITIVITY_MARK = { additive: "Σ", semi: "Σ~", non: "∅Σ" } as const;
const ADDITIVITY_OPTIONS = [
  ["additive", ADDITIVITY_LABEL.additive],
  ["semi", ADDITIVITY_LABEL.semi],
  ["non", ADDITIVITY_LABEL.non],
] as const;
// slice 19 step 2: the stored history behind the same three segments; step 3 adds Snapshot and the new texts
const SCD_OPTIONS = [
  ["keep", "0 · keep"],
  ["overwrite", "1 · overwrite"],
  ["history", "2 · history"],
] as const;
export const SCD_SENTENCE: Record<Exclude<History, "snapshot">, string> = {
  keep: "Values never change once loaded.",
  overwrite: "A change overwrites the old value; no history.",
  history: "A change adds a new version; the old one stays with its validity.",
};
export const SCD_TECHNICAL = "Technical columns (valid from, valid to, current) are a physical matter and are not modelled here.";
const NUMERIC = new Set<Attribute["data_type"]>(["integer", "decimal"]);

const NO_ROWS: CubePageRows = { cubeEntities: [], cubeMeasures: [], cubeKeys: [], cubeMappings: [], cubeMappingInputs: [] };

/**
 * The index of the model and InfoCube's rows on this page, once per data version. The page's rows come without
 * `created_*` and `updated_*` (O8): the reads here never touch them.
 */
function useCube(): CubeIndex {
  const p = usePanel();
  const rows = (useModules().data.infocube as CubePageRows | undefined) ?? NO_ROWS;
  const { entities, attributes, relationships } = p.ix.model;
  return useMemo(
    () =>
      cubeIndex({
        entities,
        attributes,
        relationships,
        cubeEntities: rows.cubeEntities as CubeEntity[],
        cubeMeasures: rows.cubeMeasures as CubeMeasure[],
        cubeKeys: rows.cubeKeys as CubeKey[],
      }),
    [entities, attributes, relationships, rows],
  );
}

/** Add key (R-3): the new attribute, the fact's order and the link in one undo step, the rows it writes held. */
function useAddKey(cube: CubeIndex) {
  const p = usePanel();
  const { saveRows } = useAction();
  return (relationshipId: Uuid, factId: Uuid) => {
    const currentKeyId = cube.linkOfRelationship(relationshipId)?.id ?? null;
    const rows = [{ id: relationshipId }, ...cube.attributesOf(factId).map((a) => ({ id: a.id }))];
    return saveRows(rows, () => addKeyAction(p.workspaceId, { relationshipId, currentKeyId }), (v) => v.toast, { undoable: true });
  };
}

const keyMeta = (key: Attribute | null) =>
  key ? <span>key {key.name}</span> : <span className="text-im-warn">no key</span>;

const focusGrain = () => {
  const el = document.getElementById("f-grain");
  el?.scrollIntoView({ block: "nearest" });
  el?.focus();
};

// ---- the entity panel: a fact's or a dimension's section ----

export function CubeEntitySection({ entity }: { entity: Entity }) {
  const cube = useCube();
  const row = cube.cubeOf(entity.id);
  if (!row) return null;
  return row.role === "fact" ? <FactSection entity={entity} row={row} cube={cube} /> : <DimensionSection entity={entity} row={row} cube={cube} />;
}

function FactSection({ entity, row, cube }: { entity: Entity; row: CubeEntity; cube: CubeIndex }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { saveRow } = useAction();
  const addKey = useAddKey(cube);
  const measures = cube.attributesOf(entity.id).flatMap((a) => {
    const m = cube.measureOf(a.id);
    return m ? [{ a, m }] : [];
  });
  const keys = cube.factKeys(entity.id);
  const hints = factHints(cube, entity.id);
  const go = (h: CubeHint) => {
    const to = h.go;
    if (to.t === "grain") focusGrain();
    else if (to.t === "entity") p.goEntity(to.id);
    else if (to.t === "attribute") p.goAttribute(to.id);
    else ui.select({ t: "rel", id: to.id });
  };
  return (
    <Fold title="Fact" testId="section-cube-fact">
      <div className="rounded-lg border border-im-line px-3 pb-3 pt-0.5">
        <Field label="Grain" htmlFor="f-grain">
          <TextField
            key={fieldKey(row.id, "grain")}
            id="f-grain"
            value={row.grain ?? ""}
            readOnly={!p.editable}
            placeholder="One row per … e.g. one order line"
            onSave={(grain) => saveRow(row, (v) => updateCubeEntityAction(p.workspaceId, { cubeEntityId: row.id, expectedVersion: v, grain }))}
            keep={{ key: fieldKey(row.id, "grain"), field: "Grain", object: entity.name }}
            testId="input-cube-grain"
          />
        </Field>
        <Field label="Measures">
          {measures.length ? (
            <div data-testid="list-cube-measures">
              {measures.map(({ a, m }) => (
                <Li key={a.id} onClick={() => p.goAttribute(a.id)} meta={`${ADDITIVITY_MARK[m.additivity]} ${ADDITIVITY_LABEL[m.additivity]}${m.semi_note ? `, ${m.semi_note}` : ""}`} testId="item-cube-measure">
                  {a.name}
                </Li>
              ))}
            </div>
          ) : (
            <Hint>None yet. Open a numeric attribute and turn on Measure.</Hint>
          )}
        </Field>
        <Field label="Dimensions">
          {keys.length ? (
            <div data-testid="list-cube-dimensions">
              {keys.map((k) => (
                <div key={k.relationshipId} className="flex items-center gap-2" data-testid="item-cube-dimension" data-relationship={k.relationshipId}>
                  <div className="min-w-0 flex-1">
                    <Li onClick={() => ui.select({ t: "rel", id: k.relationshipId })} meta={keyMeta(k.key)}>
                      {dimensionAs(cube, k)}
                    </Li>
                  </div>
                  {!k.key && p.editable && (
                    <button
                      type="button"
                      className={`${smallButtonClass} disabled:opacity-50`}
                      disabled={!k.pk}
                      title={k.pk ? undefined : `${cube.nameOf(k.dimensionId)} has no primary key yet.`}
                      onClick={() => void addKey(k.relationshipId, entity.id)}
                      data-testid="button-cube-add-key"
                    >
                      Add key
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Hint>None yet. Draw a relationship to a dimension.</Hint>
          )}
        </Field>
        <Field label="Hints">
          <div className="flex flex-col gap-1" data-testid="list-cube-hints">
            {hints.length ? (
              hints.map((h, i) => (
                <button
                  type="button"
                  key={`${i}:${h.text}`}
                  className="rounded-md border-l-2 border-im-warn bg-im-warn-soft px-2 py-1 text-left text-[12px] text-im-ink hover:bg-im-hover"
                  onClick={() => go(h)}
                  data-testid="item-cube-hint"
                >
                  {h.text}
                </button>
              ))
            ) : (
              <span className="text-[12px] text-im-ink-2" data-testid="text-cube-hints-ok">
                {NO_HINTS}
              </span>
            )}
          </div>
        </Field>
      </div>
    </Fold>
  );
}

function DimensionSection({ entity, row, cube }: { entity: Entity; row: CubeEntity; cube: CubeIndex }) {
  const p = usePanel();
  const { saveRow } = useAction();
  const scd = row.history === "snapshot" || !row.history ? "overwrite" : row.history;
  const choice = useChoice<History>(scd, (v) =>
    saveRow(row, (version) => updateCubeEntityAction(p.workspaceId, { cubeEntityId: row.id, expectedVersion: version, history: v })),
  );
  const users = usedBy(cube, entity.id, p.ix.model.relationships);
  return (
    <Fold title="Dimension" testId="section-cube-dimension">
      <div className="rounded-lg border border-im-line px-3 pb-3 pt-0.5">
        <Field label="Slowly changing dimension type">
          <Seg key={fieldKey(row.id, "scd")} value={choice.value} options={SCD_OPTIONS} disabled={!p.editable} onChange={(v) => choice.choose(v)} testId="seg-cube-scd" />
          <p className="mt-1.5 text-[12px] text-im-ink-3" data-testid="text-cube-scd">
            {SCD_SENTENCE[scd]} {SCD_TECHNICAL}
          </p>
        </Field>
        <Field label="Used by">
          {users.length ? (
            <div data-testid="list-cube-used-by">
              {users.map((k) => (
                <Li key={k.relationshipId} onClick={() => p.goEntity(k.factId)} meta={keyMeta(k.key)} testId="item-cube-used-by">
                  {`${cube.nameOf(k.factId)}${asRole(k.role)}`}
                </Li>
              ))}
            </div>
          ) : (
            <Hint>No fact uses it yet.</Hint>
          )}
        </Field>
      </div>
    </Fold>
  );
}

// ---- the attribute panel: a fact's attribute's "Carries" and Measure ----

export function CubeAttributeSection({ attribute: a }: { attribute: Attribute }) {
  const cube = useCube();
  if (cube.roleOf(a.entity_id) !== "fact") return null;
  return <FactAttributeSection a={a} cube={cube} />;
}

function FactAttributeSection({ a, cube }: { a: Attribute; cube: CubeIndex }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const { saveRow, saveRows } = useAction();
  const m = cube.measureOf(a.id);
  const carried = cube.carriedBy(a.id);
  const ends = carried ? factEnds(carried, cube.roleOf) : null;

  async function toggle() {
    if (m) return saveRow(m, (v) => setMeasureAction(p.workspaceId, { on: false, attributeId: a.id, measureId: m.id, expectedVersion: v }), undefined, { deletes: true });
    const result = await saveRows([{ id: a.id }], () => setMeasureAction(p.workspaceId, { on: true, attributeId: a.id }));
    if (result.ok && result.value.warning) toast(result.value.warning);
    return result;
  }

  return (
    <>
      {a.is_foreign_key && (
        <Field label="Carries">
          {carried && ends ? (
            <div data-testid="list-cube-carries">
              <Li onClick={() => ui.select({ t: "rel", id: carried.id })} meta="relationship" testId="item-cube-carries">
                {dimensionAs(cube, { dimensionId: ends.dimension, role: roleAt(carried, ends.dimension) })}
              </Li>
            </div>
          ) : (
            <p className="mt-1 text-im-warn" data-testid="text-cube-carries-none">
              No dimension. Pick this key in a relationship to a dimension.
            </p>
          )}
        </Field>
      )}
      <Fold title="Measure" testId="section-cube-measure">
        <div className="rounded-lg border border-im-line px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5" data-testid="flag-cube-measure">
            <Flag on={!!m} label="Measure" disabled={!p.editable} onToggle={() => void toggle()} />
          </div>
          {!m && (
            <p className="mt-1.5 text-[12px] text-im-ink-3" data-testid="text-cube-not-measure">
              {a.is_foreign_key ? "A foreign key carries a dimension's key; it is not a measure." : "Not a measure: a degenerate dimension or a descriptive value of the fact."}
            </p>
          )}
          {m && <MeasureFields a={a} m={m} />}
        </div>
      </Fold>
    </>
  );
}

function MeasureFields({ a, m }: { a: Attribute; m: CubeMeasure }) {
  const p = usePanel();
  const { saveRow } = useAction();
  const save = (change: { additivity?: CubeMeasure["additivity"]; semiNote?: string | null }) =>
    saveRow(m, (v) => updateMeasureAction(p.workspaceId, { measureId: m.id, expectedVersion: v, ...change }));
  const additivity = useChoice(m.additivity, (v) => save({ additivity: v }));
  return (
    <>
      <Field label="Additivity">
        <Seg key={fieldKey(m.id, "additivity")} value={additivity.value} options={ADDITIVITY_OPTIONS} disabled={!p.editable} onChange={(v) => additivity.choose(v)} testId="seg-cube-additivity" />
      </Field>
      {m.additivity === "semi" && (
        <Field label="Not additive across" htmlFor="f-semi">
          <TextField
            key={fieldKey(m.id, "semi")}
            id="f-semi"
            value={m.semi_note ?? ""}
            readOnly={!p.editable}
            placeholder="e.g. Date (a balance)"
            onSave={(semiNote) => save({ semiNote })}
            keep={{ key: fieldKey(m.id, "semi"), field: "Not additive across", object: a.name }}
            testId="input-cube-semi"
          />
        </Field>
      )}
      {!NUMERIC.has(a.data_type) && (
        <Note warn testId="hint-cube-measure-type">
          Its type is {typeWord(a)}. Measures are usually Integer or Decimal.
        </Note>
      )}
    </>
  );
}

// ---- the relationship panel: a fact – dimension relationship's key (R-1, R-3) ----

export function CubeRelationshipSection({ relationship: r }: { relationship: Relationship }) {
  const cube = useCube();
  const ends = factEnds(r, cube.roleOf);
  if (!ends) return null;
  return <KeySection r={r} fact={ends.fact} dimension={ends.dimension} cube={cube} />;
}

function KeySection({ r, fact, dimension, cube }: { r: Relationship; fact: Uuid; dimension: Uuid; cube: CubeIndex }) {
  const p = usePanel();
  const { saveRows } = useAction();
  const addKey = useAddKey(cube);
  const key = cube.keyOf(r.id);
  const pk = cube.pkOf(dimension);
  // the fact's foreign keys that carry nothing else (an inactive link's attribute is no foreign key, R3)
  const options = cube.attributesOf(fact).filter((a) => a.is_foreign_key && (a.id === key?.id || !cube.linkOfAttribute(a.id)));
  const choice = useChoice(key?.id ?? "", (attributeId) => {
    const currentKeyId = cube.linkOfRelationship(r.id)?.id ?? null;
    const rows = [{ id: r.id }, ...(attributeId ? [{ id: attributeId }] : [])];
    return saveRows(rows, () => linkKeyAction(p.workspaceId, { relationshipId: r.id, currentKeyId, attributeId: attributeId || null }));
  });
  return (
    <Fold title="InfoCube" testId="section-cube-key">
      <div className="rounded-lg border border-im-line px-3 pb-3 pt-0.5">
        <Field label={`Key in ${cube.nameOf(fact)}`} htmlFor="f-rkey">
          <select
            key={fieldKey(r.id, "key")}
            id="f-rkey"
            value={choice.value}
            disabled={!p.editable}
            className={inputClass}
            data-testid="select-cube-key"
            onChange={(e) => choice.choose(e.target.value)}
          >
            <option value="">None</option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {!key && p.editable && (
          <div className="mt-2">
            <button type="button" className={`${smallButtonClass} disabled:opacity-50`} disabled={!pk} onClick={() => void addKey(r.id, fact)} data-testid="button-cube-add-key">
              Add key
            </button>
          </div>
        )}
        {!pk && (
          <p className="mt-1.5 text-[12px] text-im-warn" data-testid="text-cube-no-pk">
            {cube.nameOf(dimension)} has no primary key yet.
          </p>
        )}
      </div>
    </Fold>
  );
}
