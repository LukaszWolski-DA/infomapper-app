-- Slice 15a: the model level and module licences (docs/prd/slice-15-infocube.md, items 3, 5; acceptance Q4, Q6).
-- An entity's model level (C-3, AD-34): logical or dimensional, set when it is created and never changed; every entity
-- before slice 15a is logical. A dimensional entity keeps the stereotype 'object', unused (C-5), so the stereotype's
-- CHECK stays as it is.
-- A module is licensed per organization and turned on per workspace (C-7, AD-35): one live licence per organization
-- and module, ended by a soft delete; an organization's row, not a workspace's (no workspace_id, as organization_access).
-- InfoCube works in a workspace while its switch is on and its organization holds the licence.
-- DDL only: no database holds data yet (AD-31). The local data file's format 12 sets every entity logical, every
-- workspace's InfoCube off and no licences (src/data/local/file.ts).

alter table entity add column model_level text not null default 'logical',
  add constraint entity_model_level_ck check (model_level in ('logical', 'dimensional'));

alter table workspace add column infocube boolean not null default false;

create table organization_licence (
  id               uuid primary key,
  organization_id  uuid not null references organization (id),
  module           text not null,
  version          integer not null default 1,
  created_at       timestamptz not null,
  created_by       uuid not null references app_user (id),
  updated_at       timestamptz not null,
  updated_by       uuid not null references app_user (id),
  deleted_at       timestamptz,
  constraint organization_licence_module_ck check (module in ('infocube'))
);
create index organization_licence_organization_ix on organization_licence (organization_id);
create unique index organization_licence_ux on organization_licence (organization_id, module) where deleted_at is null;

alter table organization_licence enable row level security;
