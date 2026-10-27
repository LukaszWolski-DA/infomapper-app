-- Slice 7c: classifications and notes (docs/prd/slice-07c-classifications.md, items 2, 3, 5, 15; acceptance step 1).
-- A workspace's classification list (P3): built-in classifications carry the code the app's rules read (BK, PII, LK…),
-- fixed for good, and a name a workspace may change; its own ones have no code. One classification on one source table
-- or column is a classification_link (AD-15). The modeller's note on a table or column is plain text (P8, AD-17).
-- The column flags is_business_key and is_pii become links and are dropped (P3); the attribute's flags stay.
-- DDL only (answer F5): this drops the two flags without moving their data and writes no built-in rows. No database
-- holds data yet (AD-31): the move is the local data file's upgrade to format 8 (src/data/local/file.ts), and the
-- database slice seeds the 19 built-in rows of every workspace and moves any flags it finds (PRD section 9). Ids are the
-- application's (AD-11).

create table classification (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  code          text,
  name          text not null,
  name_key      text not null,
  scope         text not null,
  origin        text not null,
  version       integer not null default 1,
  created_at    timestamptz not null,
  created_by    uuid not null references app_user (id),
  updated_at    timestamptz not null,
  updated_by    uuid not null references app_user (id),
  deleted_at    timestamptz,
  constraint classification_scope_ck check (scope in ('column', 'table')),
  constraint classification_origin_ck check (origin in ('builtin', 'data_vault', 'own')),
  constraint classification_code_ck check ((origin = 'own') = (code is null))
);
create index classification_workspace_ix on classification (workspace_id);
create unique index classification_code_ux on classification (workspace_id, code) where code is not null;
create unique index classification_name_ux on classification (workspace_id, scope, name_key) where deleted_at is null;

create table classification_link (
  id                 uuid primary key,
  workspace_id       uuid not null references workspace (id),
  classification_id  uuid not null references classification (id),
  source_table_id    uuid references source_table (id),
  source_column_id   uuid references source_column (id),
  version            integer not null default 1,
  created_at         timestamptz not null,
  created_by         uuid not null references app_user (id),
  updated_at         timestamptz not null,
  updated_by         uuid not null references app_user (id),
  deleted_at         timestamptz,
  constraint classification_link_one_target_ck check (
    (case when source_table_id is null then 0 else 1 end) + (case when source_column_id is null then 0 else 1 end) = 1)
);
create index classification_link_workspace_ix on classification_link (workspace_id);
create index classification_link_classification_ix on classification_link (classification_id);
create index classification_link_table_ix on classification_link (source_table_id);
create index classification_link_column_ix on classification_link (source_column_id);
create unique index classification_link_table_ux on classification_link (classification_id, source_table_id)
  where source_table_id is not null and deleted_at is null;
create unique index classification_link_column_ux on classification_link (classification_id, source_column_id)
  where source_column_id is not null and deleted_at is null;

alter table source_table add column note_html text;
alter table source_table add column note_text text;
alter table source_column add column note_html text;
alter table source_column add column note_text text;
alter table source_column drop column is_business_key;
alter table source_column drop column is_pii;

alter table classification enable row level security;
alter table classification_link enable row level security;
