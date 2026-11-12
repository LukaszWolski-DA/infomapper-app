// A whole document as a content tree (slice 25, step 3; PRD section 2, "The document page"): the title page, the
// contents, the page frame's texts and every section that is on, each built by its registered type from the document's
// model state. Pure: what the page lays out with Paged.js in step 4. A section that is on but whose type is unknown or
// unavailable (its module off) is kept in the recipe, left out of the contents and named in a note (PRD section 3).
//
// InfoDocumenter never names a module: the section types come in (`src/compose/documents.ts` joins them).

import type { DocNode } from "@/domain/document/content";
import type { DocumentSectionType } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import type { DocLanguage, ModuleTable } from "@/domain/types";
import { label, type LabelKey } from "./labels";
import { sectionScopeOf } from "./scope";
import type { DocumentDefinition } from "./types";

export interface DocumentCoverRow {
  readonly key: "client" | "workspace" | "state" | "version" | "status" | "preparedBy";
  readonly label: string;
  readonly value: string;
}

export interface DocumentTreeSection {
  readonly id: Uuid;
  readonly type: string;
  /** The contents' link target. */
  readonly anchor: string;
  readonly heading: string;
  readonly nodes: readonly DocNode[];
}

export interface DocumentTree {
  readonly language: DocLanguage;
  readonly cover: {
    readonly organization: string;
    readonly title: string;
    readonly subtitle: string | null;
    readonly rows: readonly DocumentCoverRow[];
  };
  readonly contents: { readonly heading: string; readonly entries: readonly { readonly anchor: string; readonly text: string }[] };
  /** The running header and footer (D3), the watermark on every page but the title page (D2), "Page n of m"'s words. */
  readonly frame: { readonly header: string; readonly footer: string; readonly watermark: string; readonly page: string; readonly of: string };
  readonly sections: readonly DocumentTreeSection[];
  /** One line per section that is on and skipped: its module off, or a type no module knows. */
  readonly skipped: readonly { readonly id: Uuid; readonly type: string; readonly text: string }[];
}

export interface BuildDocumentInput {
  readonly definition: Pick<DocumentDefinition, "name" | "author_id" | "scope" | "cover" | "sections">;
  readonly state: DocumentState<ModuleTable>;
  readonly types: ReadonlyMap<string, DocumentSectionType<ModuleTable>>;
  /** The day the live model is read, `yyyy-mm-dd` ("Live model on {d}"). */
  readonly date: string;
}

const orDash = (value: string | null | undefined) => (value?.trim() ? value.trim() : "–");

export function buildDocument({ definition, state, types, date }: BuildDocumentInput): DocumentTree {
  const { snapshot } = state;
  const language = snapshot.workspace.doc_language;
  const t = (key: LabelKey, values?: Readonly<Record<string, string | number>>) => label(language, key, values);
  const scope = sectionScopeOf(definition.scope, snapshot);
  const cover = definition.cover;
  const title = cover.title?.trim() || definition.name;
  const organization = snapshot.organization?.name ?? "";
  const author = snapshot.people.find((p) => p.id === definition.author_id)?.display_name ?? "";
  const modelState = t("live", { d: date });

  const sections: DocumentTreeSection[] = [];
  const skipped: { id: Uuid; type: string; text: string }[] = [];
  for (const s of definition.sections) {
    if (!s.on) continue;
    const type = types.get(s.type);
    if (!type) {
      skipped.push({ id: s.id, type: s.type, text: t("skippedUnknown", { type: s.type }) });
      continue;
    }
    if (!type.available(snapshot.workspace)) {
      skipped.push({ id: s.id, type: s.type, text: t("skippedOff", { module: type.module ?? "", section: type.label(language) }) });
      continue;
    }
    const heading = type.heading?.(s.options)?.trim() || type.label(language);
    sections.push({ id: s.id, type: s.type, anchor: `ds-${s.id}`, heading, nodes: type.build({ state, scope, options: s.options, language }) });
  }

  return {
    language,
    cover: {
      organization,
      title,
      subtitle: cover.subtitle?.trim() || null,
      rows: [
        { key: "client", label: t("client"), value: orDash(snapshot.workspace.client_name) },
        { key: "workspace", label: t("ws"), value: snapshot.workspace.name },
        { key: "state", label: t("state"), value: modelState },
        { key: "version", label: t("ver"), value: orDash(cover.version) },
        { key: "status", label: t("status"), value: orDash(cover.status) },
        { key: "preparedBy", label: t("by"), value: orDash(cover.preparedBy?.trim() || author) },
      ],
    },
    contents: { heading: t("toc"), entries: sections.map((s) => ({ anchor: s.anchor, text: s.heading })) },
    frame: {
      header: [organization, title].filter(Boolean).join(" · "),
      footer: `${snapshot.workspace.name} · ${modelState}`,
      watermark: t("wm"),
      page: t("page"),
      of: t("of"),
    },
    sections,
    skipped,
  };
}
