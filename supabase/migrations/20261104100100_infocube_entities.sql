-- Slice 15a: InfoCube's description of facts and dimensions (docs/prd/slice-15-infocube.md, item 4; C-2, C-4, AD-33).
-- InfoCube's tables point to InfoMapper's (entity, attribute), never the other way. Exactly one cube_entity per
-- dimensional entity: its role (C-5), a fact's grain, a dimension's SCD type (0 keep, 1 overwrite, 2 history). One
-- cube_measure per attribute of a fact that is a measure, with its additivity. Deleting an entity or an attribute
-- soft-deletes these rows in the same change group (AD-23: the domain cascades, not the database).
-- DDL only: no database holds data yet (AD-31); the local data file holds these tables beside InfoMapper's once InfoCube
-- writes its first row (src/modules/infocube/data/tables.ts).

create table cube_entity (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  entity_id     uuid not null references entity (id),
  role          text not null,
  grain         text,
  scd_type      smallint,
  version       integer not null default 1,
  created_at    timestamptz not null,
  created_by    uuid not null references app_user (id),
  updated_at    timestamptz not null,
  updated_by    uuid not null references app_user (id),
  deleted_at    timestamptz,
  constraint cube_entity_role_ck check (role in ('fact', 'dimension')),
  constraint cube_entity_shape_ck check (
    (role = 'fact' and scd_type is null) or (role = 'dimension' and grain is null and scd_type in (0, 1, 2)))
);
create index cube_entity_workspace_ix on cube_entity (workspace_id);
create unique index cube_entity_entity_ux on cube_entity (entity_id) where deleted_at is null;

create table cube_measure (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  attribute_id  uuid not null references attribute (id),
  additivity    text not null,
  semi_note     text,
  version       integer not null default 1,
  created_at    timestamptz not null,
  created_by    uuid not null references app_user (id),
  updated_at    timestamptz not null,
  updated_by    uuid not null references app_user (id),
  deleted_at    timestamptz,
  constraint cube_measure_additivity_ck check (additivity in ('additive', 'semi', 'non'))
);
create index cube_measure_workspace_ix on cube_measure (workspace_id);
create unique index cube_measure_attribute_ux on cube_measure (attribute_id) where deleted_at is null;

alter table cube_entity enable row level security;
alter table cube_measure enable row level security;
