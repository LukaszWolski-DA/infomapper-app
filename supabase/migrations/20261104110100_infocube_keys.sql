-- Slice 15b: InfoCube's key links (docs/prd/slice-15-infocube.md, RQ-3; role-playing spec RP-B, RP-C; AD-33). A row
-- says that this relationship between a fact and a dimension is carried by this attribute of the fact: one key per
-- relationship and one relationship per attribute among live rows. Picked or added, never matched by name. Deleting the
-- relationship or the attribute soft-deletes the link in the same change group (AD-23: the domain cascades, not the
-- database). While the attribute is no foreign key the link is kept and read as absent (inactive).
-- DDL only: no database holds data yet (AD-31); the local data file holds the table once InfoCube writes its first link.

create table cube_key (
  id               uuid primary key,
  workspace_id     uuid not null references workspace (id),
  relationship_id  uuid not null references relationship (id),
  attribute_id     uuid not null references attribute (id),
  version          integer not null default 1,
  created_at       timestamptz not null,
  created_by       uuid not null references app_user (id),
  updated_at       timestamptz not null,
  updated_by       uuid not null references app_user (id),
  deleted_at       timestamptz
);
create index cube_key_workspace_ix on cube_key (workspace_id);
create unique index cube_key_relationship_ux on cube_key (relationship_id) where deleted_at is null;
create unique index cube_key_attribute_ux on cube_key (attribute_id) where deleted_at is null;

alter table cube_key enable row level security;
