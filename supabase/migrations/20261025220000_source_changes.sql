-- Slice 7b: consequences of source changes (docs/prd/slice-07b-source-changes.md, items 1–5; acceptance step 1).
-- A change to resolve records what an import found that needs a decision and how it was settled (P3): its kind and
-- severity, the objects it names (kept when they are deleted, soft deletes), a label and a detail written when it was
-- raised, and the resolution with who and when. A source table or column that left may be retired, kept as historical
-- (P6); a column may be marked not needed (P10). An import counts the changes it raised.
-- No valid_until on mapping: a mapping is historical when every input's column is retired (step 1, Q10). The open
-- changes of slice 7a's imports are derived by the local data file's upgrade (F1); there is no data here to derive from
-- (AD-31), and ids are the application's (AD-11).

alter table source_table add column retired_since timestamptz;
alter table source_table add constraint source_table_retired_ck check (retired_since is null or missing_since is not null);

alter table source_column add column retired_since timestamptz;
alter table source_column add column not_needed boolean not null default false;
alter table source_column add constraint source_column_retired_ck check (retired_since is null or missing_since is not null);

alter table source_import add column changes_raised integer not null default 0;
alter table source_import add column changes_high integer not null default 0;
alter table source_import drop constraint source_import_counts_ck;
alter table source_import add constraint source_import_counts_ck check (
  tables_new >= 0 and columns_new >= 0 and columns_changed >= 0 and columns_renamed >= 0 and columns_missing >= 0 and
  relationships_new >= 0 and changes_raised >= 0 and changes_high >= 0);

create table source_change (
  id                uuid primary key,
  workspace_id      uuid not null references workspace (id),
  source_system_id  uuid not null references source_system (id),
  source_import_id  uuid not null references source_import (id),
  kind              text not null,
  severity          text not null,
  status            text not null default 'open',
  source_table_id   uuid references source_table (id),
  source_column_id  uuid references source_column (id),
  mapping_id        uuid references mapping (id),
  object_label      text not null,
  detail            text not null,
  resolution        text,
  resolved_by       uuid references app_user (id),
  resolved_at       timestamptz,
  version           integer not null default 1,
  created_at        timestamptz not null,
  created_by        uuid not null references app_user (id),
  updated_at        timestamptz not null,
  updated_by        uuid not null references app_user (id),
  deleted_at        timestamptz,
  constraint source_change_kind_ck check (kind in ('column_left', 'table_left', 'new_column', 'new_table', 'type_conflict', 'business_key_changed', 'rule_updated')),
  constraint source_change_severity_ck check (severity in ('high', 'normal')),
  constraint source_change_status_ck check (status in ('open', 'resolved')),
  constraint source_change_resolved_ck check (
    (status = 'resolved') = (resolution is not null and resolved_by is not null and resolved_at is not null)),
  constraint source_change_object_ck check (
    case
      when kind in ('table_left', 'new_table') then source_table_id is not null and source_column_id is null and mapping_id is null
      when kind in ('column_left', 'new_column') then source_column_id is not null and mapping_id is null
      when kind = 'business_key_changed' then source_column_id is not null
      else mapping_id is not null
    end)
);
create index source_change_workspace_ix on source_change (workspace_id);
create index source_change_open_ix on source_change (source_system_id, status) where deleted_at is null;
create index source_change_import_ix on source_change (source_import_id);
create index source_change_column_ix on source_change (source_column_id);
create index source_change_mapping_ix on source_change (mapping_id);

alter table source_change enable row level security;
