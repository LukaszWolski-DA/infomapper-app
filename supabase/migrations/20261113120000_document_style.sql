-- Slice 26: InfoDocumenter's editor (docs/prd/slice-26-infodocumenter-editor.md; acceptance doc, F9 to F11). A
-- document's recipe gets its style (language, template, accent, colours, paper, orientation, notation, keep-rows, the
-- switches, the header's and the footer's fields), JSON read and written whole like the rest of the recipe (AD-18's
-- fourth place); the domain checks its shape. A section entry's heading and page break are inside `sections`.
-- A recipe stored before this slice is read with the defaults and the workspace's language (`upgradeDocument`).
-- DDL only: no database holds data yet (AD-31).

alter table document_definition add column style jsonb not null default '{}'::jsonb;

alter table document_definition drop constraint document_definition_recipe_ck;
alter table document_definition add constraint document_definition_recipe_ck check (
  jsonb_typeof(scope) = 'object' and jsonb_typeof(cover) = 'object' and jsonb_typeof(style) = 'object'
  and jsonb_typeof(sections) = 'array');
