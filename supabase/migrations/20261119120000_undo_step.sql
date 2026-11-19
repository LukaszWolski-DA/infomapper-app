-- Slice 30: the lasting undo history (docs/prd/slice-30-database-writes.md; acceptance doc, Q4, F3, F4, L3).
-- One row per step of a person's undo or redo list in a workspace, the last 50 of each; the step reverted next is the
-- highest position. Written only in the transaction of the write it records, undoes or redoes (src/data/postgres/
-- undo-history.ts). A step's events are its change group's `change_event` rows (indexed by `change_group_id`). Not model
-- data: no version, no change event, no soft delete; a step leaves the history by a hard delete. The local adapter keeps
-- its history in memory (Q4 (a)), so the local file has no such table.

create table undo_step (
  workspace_id    uuid not null references workspace (id),
  user_id         uuid not null references app_user (id),
  list            text not null,
  position        integer not null,
  change_group_id uuid not null,
  label           text not null,
  created_at      timestamptz not null,
  constraint undo_step_pkey primary key (workspace_id, user_id, list, position),
  constraint undo_step_list_ck check (list in ('undo', 'redo'))
);

-- a change group is in one list at a time
create unique index undo_step_group_ux on undo_step (workspace_id, change_group_id);

alter table undo_step enable row level security;
