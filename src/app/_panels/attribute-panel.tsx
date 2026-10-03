"use client";

// The attribute panel (prototype insAttr): name, data type with its parameters (AD-27), flags with the business-key
// suggestion (AD-28), definition (plain text, AD-30), where it comes from (one row per mapping, D-49),
// “Add a source column” to create a mapping, and delete.

import { useContext, useEffect, useRef } from "react";
import { createMappingAction } from "@/app/_actions/mapping";
import { deleteAttributeAction, updateAttributeAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { CanvasUiCtx } from "@/canvas/context";
import type { UpdateAttributeInput } from "@/domain/commands/attribute";
import { checkMappingTypes } from "@/domain/model/type-check";
import { LOGICAL_TYPES, type Attribute, type LogicalType } from "@/domain/types";
import { useToast } from "@/ui/components/toast";
import {
  Actions,
  ConfirmDelete,
  Field,
  Flag,
  GroupedSelect,
  Hint,
  inputClass,
  Kind,
  Li,
  Note,
  Fold,
  LongList,
  smallButtonClass,
  TextArea,
  TextField,
  TypeDot,
} from "./fields";
import { usePanel } from "./inspector";
import { attributeLabel, businessKeyHint, columnLabel, columnOptions, inputColumns, inputsLabel, typeCheckOf } from "./model-index";
import { usePanels } from "./panels-context";

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

/** A number field for a type parameter: empty means none. */
const toNumber = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export function AttributePanel({ attribute: a }: { attribute: Attribute }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const { run } = useAction();
  const toast = useToast();
  const { nameFocus, setNameFocus } = usePanels();
  const nameRef = useRef<HTMLInputElement>(null);
  const ix = p.ix;
  const entity = ix.entity.get(a.entity_id);
  const mappings = ix.mappingsOf.get(a.id) ?? [];
  const bkColumns = businessKeyHint(ix, a);
  const mappedColumns = new Set(mappings.flatMap((m) => inputColumns(ix, m.id).map((c) => c.id)));

  useEffect(() => {
    if (nameFocus !== a.id) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setNameFocus(null);
  }, [nameFocus, a.id, setNameFocus]);

  const save = (change: Change) => run(() => updateAttributeAction(p.workspaceId, { attributeId: a.id, expectedVersion: a.version, ...change }));

  const type: TypeInput = {
    dataType: a.data_type,
    customType: a.custom_type,
    length: a.type_length,
    precision: a.type_precision,
    scale: a.type_scale,
  };
  const saveType = (patch: Partial<TypeInput>) => void save({ type: { ...type, ...patch } });

  async function addColumn(columnId: string) {
    const result = await run(() => createMappingAction(p.workspaceId, { attributeId: a.id, sourceColumnId: columnId }));
    if (!result.ok) return;
    const column = ix.column.get(columnId);
    const fits = column ? checkMappingTypes({ kind: "direct", rule_expression: null }, a, [column]).ok : true;
    toast(`Mapped ${columnLabel(ix, columnId)} to ${attributeLabel(ix, a.id)}${fits ? "" : ". The data types don't fit."}`);
    ui.select({ t: "map", id: result.value.mappingId });
  }

  async function remove() {
    const n = mappings.length;
    const result = await run(
      () => deleteAttributeAction(p.workspaceId, { attributeId: a.id, expectedVersion: a.version }),
      `Attribute deleted${n ? ` together with ${n} mapping${n > 1 ? "s" : ""}` : ""}`,
    );
    if (result.ok) ui.select(null);
  }

  const v = `${a.id}:${a.version}`;
  return (
    <div data-testid="panel-attribute">
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
        <TextField key={v} id="f-an" value={a.name} required readOnly={!p.editable} onSave={(name) => void save({ name })} testId="input-attribute-name" inputRef={nameRef} />
      </Field>

      <Field label="Data type" htmlFor="f-at">
        <div className="flex gap-2">
          <select
            key={v}
            id="f-at"
            defaultValue={a.data_type}
            disabled={!p.editable}
            className={`${inputClass} flex-1`}
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
            <ParamField key={`l${v}`} label="Length" value={a.type_length} disabled={!p.editable} onSave={(n) => saveType({ length: n })} testId="input-type-length" />
          )}
          {a.data_type === "decimal" && (
            <>
              <ParamField key={`p${v}`} label="Precision" value={a.type_precision} disabled={!p.editable} onSave={(n) => saveType({ precision: n })} testId="input-type-precision" />
              <ParamField key={`s${v}`} label="Scale" value={a.type_scale} disabled={!p.editable} onSave={(n) => saveType({ scale: n })} testId="input-type-scale" />
            </>
          )}
        </div>
        {a.data_type === "custom" && (
          <div className="mt-2">
            <TextField key={`c${v}`} value={a.custom_type ?? ""} readOnly={!p.editable} onSave={(customType) => saveType({ customType })} testId="input-type-custom" mono />
            <div className="mt-1 text-[11.5px] text-im-ink-3">The type’s name, e.g. uuid.</div>
          </div>
        )}
      </Field>

      <Field label="Flags">
        <div className="flex flex-wrap gap-1.5" data-testid="flags-attribute">
          {FLAGS.map(([key, column, label]) => (
            <Flag key={key} on={a[column]} label={label} disabled={!p.editable} onToggle={() => void save({ [key]: !a[column] })} />
          ))}
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

      <Field label="Definition" htmlFor="f-ad">
        <TextArea
          key={v}
          id="f-ad"
          value={a.definition_text ?? ""}
          readOnly={!p.editable}
          placeholder="What this attribute means for the business."
          onSave={(text) => void save({ definition: text.trim() ? text : null })}
        />
      </Field>

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

      {p.editable && (
        <Actions>
          <ConfirmDelete
            label="Delete attribute"
            also={mappings.length ? `${mappings.length} mapping${mappings.length > 1 ? "s" : ""}` : undefined}
            onConfirm={() => void remove()}
            testId="button-delete-attribute"
          />
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
      className={`${inputClass} w-[84px] flex-none`}
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

