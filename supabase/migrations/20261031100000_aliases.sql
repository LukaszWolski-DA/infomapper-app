-- Slice 11: aliases of entities and attributes, shown by the canvas (docs/prd/slice-11-aliases.md, items 1–4; D-64).
-- An alias is free text, trimmed by the domain, null when empty. A canvas shows names or aliases in two dimensions,
-- entity names and attribute names; null reads as "name". An entity card may make an exception in either dimension;
-- null follows its canvas. The modes are ordinary columns, not keys of `canvas.look`, because the look is outside undo
-- (D-12) and the modes are undo steps (slice 11 acceptance, F1). Nullable, so that undo of a change event written
-- before this migration writes them as null (slice 10c's rule for a missing column).
-- DDL only: no database holds data yet (AD-31). The local data file's format 11 gives every row the columns as null
-- (src/data/local/file.ts).

alter table entity add column alias text;

alter table attribute add column alias text;

alter table canvas
  add column entity_names text,
  add column attribute_names text,
  add constraint canvas_entity_names_ck check (entity_names is null or entity_names in ('name', 'alias')),
  add constraint canvas_attribute_names_ck check (attribute_names is null or attribute_names in ('name', 'alias'));

alter table canvas_item
  add column entity_names text,
  add column attribute_names text,
  add constraint canvas_item_entity_names_ck check (entity_names is null or entity_names in ('name', 'alias')),
  add constraint canvas_item_attribute_names_ck check (attribute_names is null or attribute_names in ('name', 'alias'));
