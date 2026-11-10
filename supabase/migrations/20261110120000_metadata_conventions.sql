-- Slice 23: metadata conventions (docs/prd/slice-23-metadata-conventions.md; acceptance doc, F3, F11, F14; D-78).
-- Every classification has an optional definition, plain text (AD-17: no rich text, so no `_html`/`_text` pair). An own
-- classification may get a code when it is added, never changed (the domain's rule): the CHECK no longer ties a code to
-- built-in ones, and every code has one shape. The code index already includes removed and deleted rows, so a code
-- stays taken. Uniqueness the way the import compares codes (case, spaces, `_`, `-`, `/` ignored) is the domain's.
-- A workspace has its naming conventions, plain text, outside undo like its other settings.
-- DDL only (F14): no database holds data yet (AD-31). The built-in rows' definitions in their workspace's
-- documentation language are the local data file's upgrade to format 15 (src/data/local/file.ts); the database slice
-- seeds them with the 19 rows.

alter table classification add column definition text;

alter table classification drop constraint classification_code_ck;
alter table classification add constraint classification_code_ck check (origin = 'own' or code is not null);
alter table classification add constraint classification_code_format_ck check (code is null or code ~ '^[A-Z][A-Z0-9_]{0,29}$');
alter table classification add constraint classification_definition_ck check (definition is null or length(definition) > 0);

alter table workspace add column naming_conventions text;
alter table workspace add constraint workspace_naming_conventions_ck check (naming_conventions is null or length(naming_conventions) > 0);
