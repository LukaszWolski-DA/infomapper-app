-- Slice 15c: InfoCube's dimensional mappings (docs/prd/slice-15-infocube.md, item 4; M1, AD-36; C-4, AD-33). A
-- cube_mapping feeds one attribute of a fact or dimension from the logical model; its cube_mapping_input rows are the
-- logical attributes it reads, in order. InfoMapper's mapping stays source column(s) -> attribute. That the target is
-- dimensional, the inputs logical and a direct copy reads exactly one input (AD-26) is the domain's check. Deleting the
-- target soft-deletes the mapping and its inputs; deleting an input's attribute soft-deletes the whole mapping (Q-5);
-- both in the same change group (AD-23: the domain cascades, not the database). The note is plain text. An approval is
-- logged (AD-06).
-- DDL only: no database holds data yet (AD-31); the local data file holds these tables once InfoCube writes its first
-- mapping (src/modules/infocube/data/tables.ts).

create table cube_mapping (
  id               uuid primary key,
  workspace_id     uuid not null references workspace (id),
  attribute_id     uuid not null references attribute (id),
  kind             text not null default 'direct',
  rule_expression  text,
  status           text not null default 'draft',
  note             text,
  approved_by      uuid references app_user (id),
  approved_at      timestamptz,
  version          integer not null default 1,
  created_at       timestamptz not null,
  created_by       uuid not null references app_user (id),
  updated_at       timestamptz not null,
  updated_by       uuid not null references app_user (id),
  deleted_at       timestamptz,
  constraint cube_mapping_kind_ck check (kind in ('direct', 'transform')),
  constraint cube_mapping_status_ck check (status in ('draft', 'review', 'approved')),
  constraint cube_mapping_approval_ck check ((status = 'approved') = (approved_at is not null))
);
create index cube_mapping_workspace_ix on cube_mapping (workspace_id);
create index cube_mapping_attribute_ix on cube_mapping (attribute_id);

create table cube_mapping_input (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  mapping_id    uuid not null references cube_mapping (id),
  attribute_id  uuid not null references attribute (id),
  sort_order    integer not null,
  version       integer not null default 1,
  created_at    timestamptz not null,
  created_by    uuid not null references app_user (id),
  updated_at    timestamptz not null,
  updated_by    uuid not null references app_user (id),
  deleted_at    timestamptz
);
create index cube_mapping_input_workspace_ix on cube_mapping_input (workspace_id);
create index cube_mapping_input_attribute_ix on cube_mapping_input (attribute_id);
create unique index cube_mapping_input_ux on cube_mapping_input (mapping_id, attribute_id) where deleted_at is null;

alter table cube_mapping enable row level security;
alter table cube_mapping_input enable row level security;
