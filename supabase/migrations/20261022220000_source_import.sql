-- Slice 7a: source import and re-import (docs/prd/slice-07a-source-import.md, items 1–5; acceptance step 1).
-- A source table may be a flat file with its format; tables, columns and relationships an import no longer finds get
-- missing_since (missing is a status, not a delete, P3). A source column's length -1 is max (answer 3). Foreign keys
-- between source tables are relationships with their column pairs; every import is recorded with its counts (who and
-- when are created_by and created_at). A mapping an import sends back to review keeps the reason (P6, answer 6).

alter table source_table drop constraint source_table_object_type_ck;
alter table source_table add constraint source_table_object_type_ck check (object_type in ('table', 'view', 'file'));
alter table source_table add column file_format text;
alter table source_table add column missing_since timestamptz;

alter table source_column add column missing_since timestamptz;
alter table source_column add constraint source_column_type_length_ck check (type_length is null or type_length = -1 or type_length >= 1);

alter table mapping add column review_reason text;
alter table mapping add constraint mapping_review_reason_ck check (review_reason is null or status = 'review');

create table source_relationship (
  id                  uuid primary key,
  workspace_id        uuid not null references workspace (id),
  source_table_id     uuid not null references source_table (id),
  to_source_table_id  uuid not null references source_table (id),
  name                text not null,
  kind                text not null default 'declared',
  missing_since       timestamptz,
  version             integer not null default 1,
  created_at          timestamptz not null,
  created_by          uuid not null references app_user (id),
  updated_at          timestamptz not null,
  updated_by          uuid not null references app_user (id),
  deleted_at          timestamptz,
  constraint source_relationship_kind_ck check (kind in ('declared'))
);
create index source_relationship_workspace_ix on source_relationship (workspace_id);
create index source_relationship_to_ix on source_relationship (to_source_table_id);
create unique index source_relationship_name_uq on source_relationship (source_table_id, lower(name)) where deleted_at is null;

create table source_relationship_column (
  id                      uuid primary key,
  workspace_id            uuid not null references workspace (id),
  source_relationship_id  uuid not null references source_relationship (id),
  from_column_id          uuid not null references source_column (id),
  to_column_id            uuid not null references source_column (id),
  sort_order              integer not null default 0,
  version                 integer not null default 1,
  created_at              timestamptz not null,
  created_by              uuid not null references app_user (id),
  updated_at              timestamptz not null,
  updated_by              uuid not null references app_user (id),
  deleted_at              timestamptz
);
create index source_relationship_column_workspace_ix on source_relationship_column (workspace_id);
create index source_relationship_column_relationship_ix on source_relationship_column (source_relationship_id, sort_order);
create index source_relationship_column_from_ix on source_relationship_column (from_column_id);
create index source_relationship_column_to_ix on source_relationship_column (to_column_id);

create table source_import (
  id                 uuid primary key,
  workspace_id       uuid not null references workspace (id),
  source_system_id   uuid not null references source_system (id),
  channel            text not null,
  source_label       text not null,
  tables_new         integer not null default 0,
  columns_new        integer not null default 0,
  columns_changed    integer not null default 0,
  columns_renamed    integer not null default 0,
  columns_missing    integer not null default 0,
  relationships_new  integer not null default 0,
  version            integer not null default 1,
  created_at         timestamptz not null,
  created_by         uuid not null references app_user (id),
  updated_at         timestamptz not null,
  updated_by         uuid not null references app_user (id),
  deleted_at         timestamptz,
  constraint source_import_channel_ck check (channel in ('file', 'query', 'ddl')),
  constraint source_import_counts_ck check (
    tables_new >= 0 and columns_new >= 0 and columns_changed >= 0 and columns_renamed >= 0 and columns_missing >= 0 and
    relationships_new >= 0)
);
create index source_import_workspace_ix on source_import (workspace_id);
create index source_import_system_ix on source_import (source_system_id, created_at);

alter table source_relationship enable row level security;
alter table source_relationship_column enable row level security;
alter table source_import enable row level security;
