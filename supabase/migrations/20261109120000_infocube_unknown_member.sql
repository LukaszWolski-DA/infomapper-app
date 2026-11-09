-- Slice 22: a dimension's unknown member (docs/prd/slice-22-unknown-member.md; acceptance doc; D-77). A dimension has an
-- unknown member or not (`has_unknown_member`, true for every dimension, existing and new; a fact has none): the row a
-- fact row gets when its key is empty or has no match. Its values are one per attribute, stored only when typed:
-- `cube_attribute`, one live row per attribute of a dimension, named generally for later per-attribute settings of a
-- dimensional attribute. A cleared value soft-deletes its row; deleting the attribute soft-deletes it in the same change
-- group (AD-23: the domain cascades, not the database). That the attribute is a dimension's is the domain's check.
-- No database holds data yet (AD-31); the update converts rows all the same. The local data file's older rows are
-- converted when the file is loaded (`TableRules.upgrade`, src/modules/infocube/data/tables.ts).

alter table cube_entity add column has_unknown_member boolean;
update cube_entity set has_unknown_member = true where role = 'dimension';

alter table cube_entity drop constraint cube_entity_shape_ck;
alter table cube_entity add constraint cube_entity_shape_ck check (
  (role = 'fact' and fact_type is not null and is_factless is not null
     and dim_kind is null and history is null and snapshot_period is null and has_unknown_member is null)
  or (role = 'dimension' and grain is null and fact_type is null and is_factless is null
     and base_fact_entity_id is null and dim_kind is not null and history is not null and has_unknown_member is not null));

create table cube_attribute (
  id               uuid primary key,
  workspace_id     uuid not null references workspace (id),
  attribute_id     uuid not null references attribute (id),
  unknown_value    text,
  version          integer not null default 1,
  created_at       timestamptz not null,
  created_by       uuid not null references app_user (id),
  updated_at       timestamptz not null,
  updated_by       uuid not null references app_user (id),
  deleted_at       timestamptz,
  constraint cube_attribute_unknown_value_ck
    check (unknown_value is null or (unknown_value <> '' and unknown_value = btrim(unknown_value)))
);
create index cube_attribute_workspace_ix on cube_attribute (workspace_id);
create unique index cube_attribute_attribute_ux on cube_attribute (attribute_id) where deleted_at is null;

alter table cube_attribute enable row level security;
