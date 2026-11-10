-- Slice 24: entity stereotypes (docs/prd/slice-24-entity-stereotypes.md; acceptance doc, F1, F3, F19; D-79).
-- A workspace keeps a list of entity stereotypes: the five built-in ones with fixed codes, renamed and defined but never
-- removed, and its own. An entity keeps a stereotype's code, so the CHECK on the five values goes and a composite foreign
-- key on (workspace_id, code) replaces it (Łukasz, step 1: in SQL only; the local adapter's keys point to ids, so there
-- the domain alone keeps the rule, known-limitations.md). A soft-deleted stereotype is the domain's to keep from being
-- used. Codes are unique per workspace among every row, deleted ones included, so a code is never given twice; the
-- comparison D-78 uses (case, spaces, `_`, `-`, `/` ignored) is the domain's, as for classifications.
-- DDL only (AD-31): no database holds data yet. Existing workspaces' five rows (English names, definitions in their
-- documentation language) are the local data file's upgrade to format 16 (src/data/local/upgrade-16.ts); the database
-- slice seeds them with the rest.

create table stereotype (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  code          text not null,
  name          text not null,
  name_key      text not null,
  definition    text,
  origin        text not null,
  version       integer not null default 1,
  created_at    timestamptz not null,
  created_by    uuid not null references app_user (id),
  updated_at    timestamptz not null,
  updated_by    uuid not null references app_user (id),
  deleted_at    timestamptz,
  constraint stereotype_origin_ck check (origin in ('builtin', 'own')),
  constraint stereotype_code_format_ck check (code ~ '^[a-z][a-z0-9_]{0,29}$'),
  constraint stereotype_builtin_code_ck check (origin <> 'builtin' or code in ('object', 'link', 'dictionary', 'context', 'informative')),
  constraint stereotype_builtin_kept_ck check (origin = 'own' or deleted_at is null),
  constraint stereotype_definition_ck check (definition is null or length(definition) > 0)
);
create index stereotype_workspace_ix on stereotype (workspace_id);
create unique index stereotype_code_ux on stereotype (workspace_id, code);
create unique index stereotype_name_ux on stereotype (workspace_id, name_key) where deleted_at is null;

alter table stereotype enable row level security;

alter table entity drop constraint entity_stereotype_ck;
alter table entity add constraint entity_stereotype_code_ck check (stereotype ~ '^[a-z][a-z0-9_]{0,29}$');
alter table entity add constraint entity_stereotype_fk foreign key (workspace_id, stereotype) references stereotype (workspace_id, code);
create index entity_stereotype_ix on entity (workspace_id, stereotype);
