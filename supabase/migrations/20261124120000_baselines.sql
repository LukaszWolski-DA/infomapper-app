-- Slice 35 (D-87; AD-03, AD-12, AD-14): baselines are built. The table exists since the initial schema (no code ever
-- wrote a row); it gets AD-12's standard columns it lacked, the name's key for the case-insensitive unique name among live
-- baselines (B1.3, step 1's F6: a column the server writes, as `classification.name_key` and `stereotype.name_key`), the
-- list's summary (three counts written with the row and never changed) and its checks. `snapshot` stays the content,
-- written by the insert only and never read with the row. RLS is on already (20261002000100_enable_rls.sql).

alter table baseline
  add column version integer not null default 1,
  add column updated_at timestamptz,
  add column updated_by uuid references app_user (id),
  add column deleted_at timestamptz,
  add column name_key text,
  add column entity_count integer not null default 0,
  add column mapping_count integer not null default 0,
  add column requirement_count integer not null default 0;

-- no row exists (no code ever wrote one); for any that did, the time and person it was taken, and its name's key
update baseline set updated_at = created_at, updated_by = created_by, name_key = lower(regexp_replace(btrim(name), '\s+', ' ', 'g'));

alter table baseline
  alter column updated_at set not null,
  alter column updated_by set not null,
  alter column name_key set not null,
  alter column entity_count drop default,
  alter column mapping_count drop default,
  alter column requirement_count drop default,
  add constraint baseline_name_ck check (name = btrim(name) and char_length(name) between 1 and 120),
  add constraint baseline_note_ck check (note is null or (note = btrim(note) and char_length(note) between 1 and 1000)),
  add constraint baseline_snapshot_ck check (jsonb_typeof(snapshot) = 'object'),
  add constraint baseline_counts_ck check (entity_count >= 0 and mapping_count >= 0 and requirement_count >= 0 and snapshot_schema >= 1);

create unique index baseline_name_uq on baseline (workspace_id, name_key) where deleted_at is null;
