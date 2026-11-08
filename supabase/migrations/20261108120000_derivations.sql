-- Slice 18: derivations (docs/prd/slice-18-derivations.md, items 1 and 4; acceptance Q1, Q2, F15). An attribute, logical
-- or dimensional, may be calculated from other attributes of the same entity, with a plain-text rule: `is_calculated`
-- says so (a calculated attribute may have no inputs yet, Q1), `calc_rule` is its rule and `attribute_input` its inputs,
-- in order. That an input belongs to the same entity and closes no cycle is the domain's check, and so is "inputs only
-- while calculated". Deleting an attribute soft-deletes its input rows on both sides, in the same change group (AD-23:
-- the domain cascades, not the database).
-- InfoCube's dimensional mapping gets a third kind, `lookup`: one attribute of a dictionary read through a logical
-- relationship of that dictionary (`lookup_relationship_id`), with an optional value for no match (`lookup_default`).
-- That a lookup reads exactly one input is the domain's check (AD-26, as a direct copy). The relationship may be
-- soft-deleted: the lookup keeps its id, so its panel can say the relationship is gone (F15), as a copy keeps a deleted
-- original (slice 10c). The two lookup columns are kept when the kind changes and read only for a lookup.
-- DDL only: no database holds data yet (AD-31). The local data file's format 14 gives every attribute `is_calculated`
-- false and `calc_rule` null and the file an empty `attribute_input` (src/data/local/file.ts); InfoCube reads the two
-- lookup columns as null where a row lacks them (src/modules/infocube/data/tables.ts).

alter table attribute add column is_calculated boolean not null default false;
alter table attribute add column calc_rule text;
alter table attribute add constraint attribute_calc_ck check (is_calculated or calc_rule is null);

create table attribute_input (
  id                  uuid primary key,
  workspace_id        uuid not null references workspace (id),
  attribute_id        uuid not null references attribute (id),
  input_attribute_id  uuid not null references attribute (id),
  sort_order          integer not null,
  version             integer not null default 1,
  created_at          timestamptz not null,
  created_by          uuid not null references app_user (id),
  updated_at          timestamptz not null,
  updated_by          uuid not null references app_user (id),
  deleted_at          timestamptz,
  constraint attribute_input_self_ck check (attribute_id <> input_attribute_id)
);
create index attribute_input_workspace_ix on attribute_input (workspace_id);
create index attribute_input_attribute_ix on attribute_input (attribute_id, sort_order);
create index attribute_input_input_ix on attribute_input (input_attribute_id);
create unique index attribute_input_ux on attribute_input (attribute_id, input_attribute_id) where deleted_at is null;

alter table attribute_input enable row level security;

alter table cube_mapping drop constraint cube_mapping_kind_ck;
alter table cube_mapping add constraint cube_mapping_kind_ck check (kind in ('direct', 'transform', 'lookup'));
alter table cube_mapping add column lookup_relationship_id uuid references relationship (id);
alter table cube_mapping add column lookup_default text;
create index cube_mapping_lookup_relationship_ix on cube_mapping (lookup_relationship_id);
