-- Slice 25: InfoDocumenter, documents from the live model (docs/prd/slice-25-infodocumenter-documents.md; acceptance
-- doc, F2, F4 to F6, F12, F15). A module licensed per organization and turned on per workspace (AD-35): its licence is a
-- row of `organization_licence` with the module 'infodoc', its switch `workspace.infodoc`, outside undo like
-- `workspace.infocube`; turning it off is always allowed and deletes nothing.
-- A document is a stored definition, InfoDocumenter's own table, outside the model and outside undo (R2-4a2): every
-- save writes a change event and checks the row's version (AD-12, D-59). Its recipe (`scope`, `cover`, `sections`) is
-- JSON, read and written whole and never searched (AD-18's fourth place, F5 a); the domain checks its shape.
-- A document from a baseline comes with the baselines' slice: the source is `live` without a baseline, or `baseline`
-- with one (the domain accepts `live` only in this slice).
-- DDL only: no database holds data yet (AD-31). The local data file's format 17 turns every workspace's InfoDocumenter
-- off (src/data/local/file.ts).

alter table workspace add column infodoc boolean not null default false;

alter table organization_licence drop constraint organization_licence_module_ck;
alter table organization_licence add constraint organization_licence_module_ck check (module in ('infocube', 'infodoc'));

create table document_definition (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  name          text not null,
  author_id     uuid not null references app_user (id),
  shared        boolean not null default false,
  audience      text,
  preset        text not null,
  source_kind   text not null default 'live',
  baseline_id   uuid references baseline (id),
  scope         jsonb not null,
  cover         jsonb not null,
  sections      jsonb not null,
  version       integer not null default 1,
  created_at    timestamptz not null,
  created_by    uuid not null references app_user (id),
  updated_at    timestamptz not null,
  updated_by    uuid not null references app_user (id),
  deleted_at    timestamptz,
  constraint document_definition_name_ck check (length(name) > 0 and name = btrim(name)),
  constraint document_definition_preset_ck check (preset in ('dictionary', 's2t', 'blank')),
  constraint document_definition_source_ck check (
    (source_kind = 'live' and baseline_id is null) or (source_kind = 'baseline' and baseline_id is not null)),
  constraint document_definition_recipe_ck check (
    jsonb_typeof(scope) = 'object' and jsonb_typeof(cover) = 'object' and jsonb_typeof(sections) = 'array')
);
create index document_definition_workspace_ix on document_definition (workspace_id) where deleted_at is null;
create index document_definition_author_ix on document_definition (author_id);

alter table document_definition enable row level security;
