-- Slice 10c: copying an attribute to another entity (docs/prd/slice-10c-copy-attribute.md, item 1; acceptance F9, Q5).
-- The attribute a copy was made from. Null for an attribute not made by paste, and after "Stop following". It may point
-- to a soft-deleted attribute: that is the copy's lost reference, so it is a plain foreign key with no "on delete"
-- clause (deletes are soft; a later workspace delete removes all of a workspace's attributes in one statement, where
-- Postgres checks a NO ACTION key at the statement's end).
-- DDL only: no database holds data yet (AD-31). The local data file's format 10 gives every attribute the column as
-- null (src/data/local/file.ts).

alter table attribute add column copied_from_attribute_id uuid references attribute (id);

create index attribute_copied_from_ix on attribute (copied_from_attribute_id);
