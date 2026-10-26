"use client";

// Workspace settings as in the prototype: each field saves when it changes (no Save button).
// Every save sends the version this page read; a stale version is refused with the domain's message (AD-12).
// Slice 7c (item 17, answers F16, F17): the methodology text names the source table panels; switching Data Vault 2.0
// mode off says how many uses of Data Vault classifications stay stored.

import { useRef, useState } from "react";
import { DATA_VAULT_MODE_TEXT, dataVaultOffMessage } from "@/domain/model/classifications";
import type { DocLanguage } from "@/domain/types";
import { updateWorkspaceSettingsAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";

export interface SettingsValues {
  workspaceId: string;
  version: number;
  name: string;
  clientName: string;
  description: string;
  docLanguage: DocLanguage;
  dv2Mode: boolean;
  fourEyes: boolean;
}

const LANGUAGES: [DocLanguage, string][] = [
  ["en", "English"],
  ["pl", "Polski"],
  ["de", "Deutsch"],
];

type Patch = Partial<Omit<SettingsValues, "workspaceId" | "version">>;

const SAVED_MESSAGE = (patch: Patch, dataVaultUses: number): string => {
  if (patch.dv2Mode !== undefined) return patch.dv2Mode ? "Data Vault 2.0 mode is on." : dataVaultOffMessage(dataVaultUses);
  if (patch.fourEyes !== undefined) return patch.fourEyes ? "Four-eyes approval is on." : "Four-eyes approval is off.";
  return "Settings saved.";
};

const fieldClass =
  "min-h-8 w-full rounded-md border border-im-line bg-im-surface px-2 py-1.5 disabled:opacity-60 disabled:cursor-default";

/** `dataVaultUses`: the workspace's uses of Data Vault classifications (answer F16), for the mode-off message. */
export function SettingsForm({ initial, editable, dataVaultUses = 0 }: { initial: SettingsValues; editable: boolean; dataVaultUses?: number }) {
  const { run } = useAction();
  const [version, setVersion] = useState(initial.version);
  const saved = useRef<SettingsValues>(initial);

  async function save(patch: Patch, revert: () => void) {
    const result = await run(
      () => updateWorkspaceSettingsAction({ workspaceId: initial.workspaceId, expectedVersion: version, ...patch }),
      SAVED_MESSAGE(patch, dataVaultUses),
    );
    if (result.ok) {
      setVersion(result.value.version);
      saved.current = { ...saved.current, ...patch, version: result.value.version };
    } else {
      // Nothing was saved: show the last saved value again (the toast says why).
      revert();
    }
  }

  const dis = !editable;
  return (
    <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5" data-testid="form-workspace-settings">
      <div className="rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]">
        <h4 className="m-0 mb-1 text-[13.5px] font-semibold">General</h4>
        <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">Shown on the workspace and in generated documents.</p>
        <Field label="Name">
          <input
            type="text"
            data-testid="input-workspace-name"
            className={fieldClass}
            defaultValue={initial.name}
            disabled={dis}
            onBlur={(e) => {
              const el = e.currentTarget;
              const v = el.value.trim();
              if (v === saved.current.name) return;
              void save({ name: v }, () => (el.value = saved.current.name));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </Field>
        <Field label="Client">
          <input
            type="text"
            data-testid="input-workspace-client"
            className={fieldClass}
            defaultValue={initial.clientName}
            disabled={dis}
            onBlur={(e) => {
              const el = e.currentTarget;
              const v = el.value.trim();
              if (v === saved.current.clientName) return;
              void save({ clientName: v }, () => (el.value = saved.current.clientName));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={3}
            data-testid="input-workspace-description"
            className={fieldClass + " min-h-[60px] resize-y"}
            defaultValue={initial.description}
            disabled={dis}
            onBlur={(e) => {
              const el = e.currentTarget;
              const v = el.value.trim();
              if (v === saved.current.description) return;
              void save({ description: v }, () => (el.value = saved.current.description));
            }}
          />
        </Field>
        <Field label="Documentation language">
          <select
            data-testid="select-workspace-language"
            className={fieldClass}
            defaultValue={initial.docLanguage}
            disabled={dis}
            onChange={(e) => {
              const el = e.currentTarget;
              void save({ docLanguage: el.value as DocLanguage }, () => (el.value = saved.current.docLanguage));
            }}
          >
            {LANGUAGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]">
        <h4 className="m-0 mb-1 text-[13.5px] font-semibold">Methodology</h4>
        <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2" data-testid="text-methodology">
          {DATA_VAULT_MODE_TEXT}
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="checkbox-dv2"
            defaultChecked={initial.dv2Mode}
            disabled={dis}
            onChange={(e) => {
              const el = e.currentTarget;
              void save({ dv2Mode: el.checked }, () => (el.checked = saved.current.dv2Mode));
            }}
          />{" "}
          Data Vault 2.0 mode
        </label>
        <h4 className="m-0 mb-1 mt-4 text-[13.5px] font-semibold">Process</h4>
        <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">
          Four-eyes: the author of a change to a mapping or requirement cannot approve it. Every approval is logged
          either way (AD-06).
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="checkbox-four-eyes"
            defaultChecked={initial.fourEyes}
            disabled={dis}
            onChange={(e) => {
              const el = e.currentTarget;
              void save({ fourEyes: el.checked }, () => (el.checked = saved.current.fourEyes));
            }}
          />{" "}
          Four-eyes approval
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-[11.5px] text-im-ink-3">{label}</span>
      {children}
    </label>
  );
}
