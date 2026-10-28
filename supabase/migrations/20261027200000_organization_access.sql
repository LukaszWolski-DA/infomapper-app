-- Slice 8: organizations and sign-in (docs/prd/slice-08-organizations.md, items 14, 18; acceptance F5).
-- An organization's password for signing in during development, in a table of its own so the hash never travels with
-- an organization row (F5): scrypt parameters, salt and key in one string, made by the server (src/data/password.ts).
-- Read only on the server; change events carry a marker instead of the hash. One row per organization.
-- DDL only: no database holds data yet (AD-31). The local data file's format 9 gives the demo organizations the
-- development password; the database slice replaces this with real accounts (AD-04, PRD section 9).

create table organization_access (
  organization_id  uuid primary key references organization (id),
  access_hash      text not null,
  changed_at       timestamptz not null,
  changed_by       uuid not null references app_user (id),
  version          integer not null default 1
);

alter table organization_access enable row level security;
