"use client";

// The attribute panel (prototype insAttr): name, data type with its parameters (AD-27), flags with the business-key
// suggestion (AD-28), definition (rich text in the editor dialog, slice 4a), where it comes from (one row per mapping, D-49),
// “Add a source column” to create a mapping, and delete; slice 1b: its position on the entity (D-36). Slice 10c (D-63):
// a copy names its original (“Copied from”, or that it was deleted) with “Stop following”, its type and Personal data
// read-only; an original lists its copies, saves its type and Personal data with its copies held in the save chain
// (F4), and asks before a delete that leaves copies without it (F7).

import { useContext, useEffect, useRef } from "react";
import { createMappingAction } from "@/app/_actions/mapping";
import { deleteAttributeAction, updateAttributeAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { UpdateAttributeInput } from "@/domain/commands/attribute";
import { copiesBelow, copiesStopFollowing } from "@/domain/model/copies";
import { attributeCopiesImpact } from "@/domain/model/impact";
import { checkMappingTypes } from "@/domain/model/type-check";
import { LOGICAL_TYPES, type Attribute, type LogicalType } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import { RichTextField } from "@/ui/rich-text/rich-text-field";
import {
  Actions,
  ConfirmDelete,
  dangerClass,
  Field,
  Flag,
  GroupedSelect,
  Hint,
  fieldKey,
  inputClass,
  Kind,
  Li,
  Note,
  Fold,
  LongList,
  smallButtonClass,
  TextField,
  TypeDot,
} from "./fields";
import { usePanel } from "./inspector";
import { ItemLabels } from "./item-labels";
import { useMoveAttribute } from "./move-attribute";
import { attributeLabel, businessKeyHint, columnLabel, columnOptions, inputColumns, inputsLabel, typeCheckOf } from "./model-index";
import { usePanels } from "./panels-context";
import { RequirementsSection } from "./requirements-section";

export const STATUS_LABEL = { draft: "Draft", review: "In review", approved: "Approved" } as const;

const FLAGS = [
  ["isPrimaryKey", "is_primary_key", "Primary key"],
  ["isForeignKey", "is_foreign_key", "Foreign key"],
  ["isBusinessKey", "is_business_key", "Business key"],
  ["isPii", "is_pii", "Personal data"],
  ["isNullable", "is_nullable", "Can be empty"],
] as const;

type Change = Omit<UpdateAttributeInput, "attributeId" | "expectedVersion">;
type TypeInput = NonNullable<Change["type"]>;

/**
 * The toast after an attribute's delete: “Attribute deleted”, “… together with 2 mappings”, then “. 2 copies no longer
 * follow it” (slice 10c, F7).
 */
export const attributeDeleted = (mappings: number, copies: number): string =>
  `Attribute deleted${mappings ? ` together with ${mappings} mapping${mappings > 1 ? "s" : ""}` : ""}${
    copies ? `. ${copies} ${copies === 1 ? "copy no longer follows" : "copies no longer follow"} it` : ""
  }`;

/** A number field for a type parameter: empty means none. */
const toNumber = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export function AttributePanel({ attribute: a }: { attribute: Attribute }) {
  const p = usePanel();
  const move = useMoveAttribute(p.ix, p.workspaceId);
  const ui = useContext(CanvasUiCtx);
  const { run, saveRow, saveRows } = useAction();
  const toast = useToast();
  const { nameFocus, setNameFocus } = usePanels();
  const nameRef = useRef<HTMLInputElement>(null);
  const ix = p.ix;
  const entity = ix.entity.get(a.entity_id);
  const mappings = ix.mappingsOf.get(a.id) ?? [];
  const bkColumns = businessKeyHint(ix, a);
  const mappedColumns = new Set(mappings.flatMap((m) => inputColumns(ix, m.id).map((c) => c.id)));
  // slice 10c: the original it was copied from, live or deleted (F6), and its own copies
  const originalId = a.copied_from_attribute_id;
  const original = originalId ? ix.attribute.get(originalId) : undefined;
  const lost = originalId && !original ? ix.model.lostOriginals.find((o) => o.id === originalId) : undefined;
  const copies = attributeCopiesImpact(ix.model.attributes, ix.model.entities, a.id);
  // a copy's type and Personal data follow its original while it has a link, live or deleted (F2)
  const followEditable = p.editable && !originalId;
  const follows = original ? attributeLabel(ix, original.id) : null;

  useEffect(() => {
    if (nameFocus !== a.id) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setNameFocus(null);
  }, [nameFocus, a.id, setNameFocus]);

  const save = (change: Change) => saveRow(a, (v) => updateAttributeAction(p.workspaceId, { attributeId: a.id, expectedVersion: v, ...change }));
  // a followed field writes the copies below it too (slice 10c, F4): they are held in the save chain until it answers
  const saveFollowed = (change: Change) =>
    saveRows([{ id: a.id, shown: a.version }, ...copiesBelow(ix.model.attributes, a.id).map((c) => ({ id: c.id }))], (versionOf) =>
      updateAttributeAction(p.workspaceId, { attributeId: a.id, expectedVersion: versionOf(a.id), ...change }),
    );
  // only the part that changed (slice 9, F1): a queued Scale save must not send back the precision this render showed
  const saveType = (patch: TypeInput) => void saveFollowed({ type: patch });

  async function addColumn(columnId: string) {
    const result = await run(() => createMappingAction(p.workspaceId, { attributeId: a.id, sourceColumnId: columnId }));
    if (!result.ok) return;
    const column = ix.column.get(columnId);
    const fits = column ? checkMappingTypes({ kind: "direct", rule_expression: null }, a, [column]).ok : true;
    toast(`Mapped ${columnLabel(ix, columnId)} to ${attributeLabel(ix, a.id)}${fits ? "" : ". The data types don't fit."}`);
    ui.select({ t: "map", id: result.value.mappingId });
  }

  async function remove() {
    const result = await saveRow(
      a,
      (v) => deleteAttributeAction(p.workspaceId, { attributeId: a.id, expectedVersion: v }),
      attributeDeleted(mappings.length, copies.length),
      { undoable: true, deletes: true },
    );
    if (result.ok) ui.select(null);
  }

  const siblings = p.ix.attributesOf.get(a.entity_id) ?? [];
  const position = siblings.findIndex((x) => x.id === a.id) + 1;
  return (
    <div data-testid="panel-attribute" data-version={a.version}>
      <Kind>
        Attribute of{" "}
        <button
          type="button"
          className="rounded-md bg-im-logical-soft px-1.5 py-px text-im-logical"
          onClick={() => p.goEntity(a.entity_id)}
          data-testid="link-attribute-entity"
        >
          {entity?.name}
        </button>
      </Kind>
      <Field label="Name" htmlFor="f-an">
        <TextField key={fieldKey(a.id, "name", a.name)} id="f-an" value={a.name} required readOnly={!p.editable} onSave={(name) => void save({ name })} testId="input-attribute-name" inputRef={nameRef} />
      </Field>

      <Field label="Position on the entity">
        <div className="flex items-center gap-1.5" data-testid="position-attribute">
          <span className="mr-1 tabular-nums" data-testid="value-attribute-position">
            {position} of {siblings.length}
          </span>
          {p.editable && (
            <>
              <button type="button" className="grid size-7 place-items-center rounded-md border border-im-line bg-im-surface text-im-ink-2 hover:bg-im-hover disabled:opacity-30" title="Move to the top (Ctrl Shift ↑)" aria-label="Move to the top" disabled={position === 1} onClick={() => void move(a.id, "top")}>
                ⤒
              </button>
              <button type="button" className="grid size-7 place-items-center rounded-md border border-im-line bg-im-surface text-im-ink-2 hover:bg-im-hover disabled:opacity-30" title="Move up (Ctrl ↑)" aria-label="Move up" disabled={position === 1} onClick={() => void move(a.id, "up")}>
                ↑
              </button>
              <button type="button" className="grid size-7 place-items-center rounded-md border border-im-line bg-im-surface text-im-ink-2 hover:bg-im-hover disabled:opacity-30" title="Move down (Ctrl ↓)" aria-label="Move down" disabled={position === siblings.length} onClick={() => void move(a.id, "down")}>
                ↓
              </button>
              <button type="button" className="grid size-7 place-items-center rounded-md border border-im-line bg-im-surface text-im-ink-2 hover:bg-im-hover disabled:opacity-30" title="Move to the bottom (Ctrl Shift ↓)" aria-label="Move to the bottom" disabled={position === siblings.length} onClick={() => void move(a.id, "bottom")}>
                ⤓
              </button>
            </>
          )}
        </div>
      </Field>

      {originalId && (
        <Note testId="note-copied-from">
          {original ? (
            <>
              Copied from{" "}
              <button type="button" className="font-mono text-xs text-im-logical underline-offset-2 hover:underline" onClick={() => p.goAttribute(original.id)} data-testid="link-copied-from">
                {attributeLabel(ix, original.id)}
              </button>
            </>
          ) : (
            <>Copied from {lost ? `${lost.entityName}.${lost.name}` : "an attribute"}, which was deleted.</>
          )}
          {p.editable && (
            <div className="mt-2">
              <button type="button" className={smallButtonClass} onClick={() => void save({ stopFollowing: true })} data-testid="button-stop-following">
                Stop following
              </button>
            </div>
          )}
        </Note>
      )}

      <Field label="Data type" htmlFor="f-at">
        {/* the parameters sit next to the type, and wrap under it when the panel is narrow */}
        <div className="flex flex-wrap gap-2" data-testid="field-attribute-type">
          <select
            key={fieldKey(a.id, "type", a.data_type)}
            id="f-at"
            defaultValue={a.data_type}
            disabled={!followEditable}
            className={`${inputClass} min-w-[120px] flex-1 basis-[120px]`}
            data-testid="select-attribute-type"
            onChange={(e) => saveType({ dataType: e.target.value as LogicalType })}
          >
            {LOGICAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {a.data_type === "string" && (
            <ParamField key={fieldKey(a.id, "length", a.type_length)} label="Length" value={a.type_length} disabled={!followEditable} onSave={(n) => saveType({ length: n })} testId="input-type-length" />
          )}
          {a.data_type === "decimal" && (
            <div className="flex flex-none gap-2">
              <ParamField key={fieldKey(a.id, "precision", a.type_precision)} label="Precision" value={a.type_precision} disabled={!followEditable} onSave={(n) => saveType({ precision: n })} testId="input-type-precision" />
              <ParamField key={fieldKey(a.id, "scale", a.type_scale)} label="Scale" value={a.type_scale} disabled={!followEditable} onSave={(n) => saveType({ scale: n })} testId="input-type-scale" />
            </div>
          )}
        </div>
        {a.data_type === "custom" && (
          <div className="mt-2">
            <TextField key={fieldKey(a.id, "custom", a.custom_type)} value={a.custom_type ?? ""} readOnly={!followEditable} onSave={(customType) => saveType({ customType })} testId="input-type-custom" mono />
            <div className="mt-1 text-[11.5px] text-im-ink-3">The type’s name, e.g. uuid.</div>
          </div>
        )}
        {/* the type and Personal data are the original's while it is a copy (slice 10c, item 6) */}
        {follows && (
          <div className="mt-1.5 text-[11.5px] text-im-ink-3" data-testid="hint-follows">
            Follows {follows}.
          </div>
        )}
      </Field>

      <Field label="Flags">
        <div className="flex flex-wrap gap-1.5" data-testid="flags-attribute">
          {FLAGS.map(([key, column, label]) =>
            key === "isPii" ? (
              <Flag key={key} on={a[column]} label={label} disabled={!followEditable} onToggle={() => void saveFollowed({ isPii: !a[column] })} />
            ) : (
              <Flag key={key} on={a[column]} label={label} disabled={!p.editable} onToggle={() => void save({ [key]: !a[column] })} />
            ),
          )}
        </div>
      </Field>
      {bkColumns.length > 0 && (
        <Note testId="note-bk-suggestion">
          {bkColumns.map((c) => columnLabel(ix, c.id)).join(", ")} {bkColumns.length === 1 ? "is" : "are"} marked as a business key in the
          source. Is {a.name} a business key too?
          {p.editable && (
            <div className="mt-2">
              <button type="button" className={smallButtonClass} onClick={() => void save({ isBusinessKey: true })} data-testid="button-accept-bk">
                Mark as business key
              </button>
            </div>
          )}
        </Note>
      )}

      <RichTextField
        key={fieldKey(a.id, "definition", a.definition_html)}
        label="Definition"
        html={a.definition_html}
        text={a.definition_text}
        empty="What this attribute means for the business. Click to write it."
        editable={p.editable}
        subtitle="Attribute definition"
        title={attributeLabel(ix, a.id)}
        onSave={async (html) => (await save({ definition: html })).ok}
        testId="field-attribute-definition"
      />
      <ItemLabels target={{ kind: "attribute", id: a.id }} />
      <RequirementsSection target={{ kind: "attribute", id: a.id }} />

      <Fold title="Comes from" count={mappings.length}>
        {mappings.length ? (
          <LongList
            items={mappings}
            testId="list-attribute-mappings"
            text={(m) => inputsLabel(ix, m.id)}
            render={(m) => (
              <Li key={m.id} onClick={() => p.goMapping(m.id)} meta={`${m.kind === "transform" ? "ƒ " : ""}${STATUS_LABEL[m.status]}`}>
                <span className="flex items-center gap-2">
                  <TypeDot ok={typeCheckOf(ix, m).ok} />
                  <span className="truncate font-mono text-xs">{inputsLabel(ix, m.id)}</span>
                </span>
              </Li>
            )}
          />
        ) : (
          <Hint>Not mapped yet. Pick a source column below.</Hint>
        )}
        {p.editable && (
          <Field label="Add a source column" htmlFor="f-addc">
            <GroupedSelect
              id="f-addc"
              placeholder="Choose a column…"
              groups={columnOptions(ix, p.tablesHere, mappedColumns)}
              onPick={(id) => void addColumn(id)}
              testId="select-add-source-column"
            />
          </Field>
        )}
      </Fold>

      {copies.length > 0 && (
        <Fold title="Copies" count={copies.length} testId="fold-attribute-copies">
          <LongList
            items={copies}
            testId="list-attribute-copies"
            text={(c) => c.label}
            render={(c) => (
              <Li key={c.id} onClick={() => p.goAttribute(c.id)} testId="item-attribute-copy">
                <span className="truncate font-mono text-xs">{c.label}</span>
              </Li>
            )}
          />
        </Fold>
      )}

      {p.editable && (
        <Actions>
          {mappings.length || copies.length ? (
            // With mappings or copies it still asks (slice 1b, item 13; slice 10c, F7); without, it goes at once with Undo
            // in the toast.
            <ConfirmDelete
              label="Delete attribute"
              also={mappings.length ? `${mappings.length} mapping${mappings.length > 1 ? "s" : ""}` : undefined}
              then={copies.length ? copiesStopFollowing(copies.map((c) => c.label)) : undefined}
              onConfirm={() => void remove()}
              testId="button-delete-attribute"
            />
          ) : (
            <button type="button" className={dangerClass} onClick={() => void remove()} data-testid="button-delete-attribute">
              Delete attribute
            </button>
          )}
        </Actions>
      )}
    </div>
  );
}

function ParamField({
  label,
  value,
  onSave,
  disabled,
  testId,
}: {
  label: string;
  value: number | null;
  onSave: (n: number | null) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <input
      type="number"
      min={0}
      aria-label={label}
      title={label}
      placeholder={label}
      defaultValue={value ?? ""}
      disabled={disabled}
      data-testid={testId}
      // 84 px, not the input's usual full width (which made the type's parameters run out of the panel)
      className={`${inputClass.replace("w-full", "w-[84px]")} flex-none`}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const n = toNumber(e.currentTarget.value);
        if (n !== value && (n === null || Number.isInteger(n))) onSave(n);
      }}
    />
  );
}

