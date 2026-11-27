-- Slice 39: InfoCatalog, entry and search (docs/prd/slice-39-infocatalog-entry-and-search.md; acceptance doc, C1 to C10).
-- A module licensed per organization (AD-35), with no module switch per workspace: its licence is a row of
-- `organization_licence` with the module 'infocatalog'. The workspace's switch `workspace.catalog_shown` (off by
-- default) shows the workspace in InfoCatalog to every member of its organization, read only; members with a role in
-- the workspace find it there either way. Outside undo, as the workspace's other settings.
-- InfoCatalog stores nothing: no table of its own. The local data file reads a workspace without the column as off,
-- with no format step (slice 35's precedent: an older file is not written back for it).

alter table workspace add column catalog_shown boolean not null default false;

alter table organization_licence drop constraint organization_licence_module_ck;
alter table organization_licence add constraint organization_licence_module_ck check (module in ('infocube', 'infodoc', 'infocatalog'));
