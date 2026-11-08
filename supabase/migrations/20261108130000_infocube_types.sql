-- Slice 19: InfoCube types (docs/prd/slice-19-infocube-types.md; acceptance doc, the data model; D-74). A fact has a type
-- (transaction, periodic snapshot, accumulating snapshot; every fact starts as a transaction), may be factless, and may
-- be an aggregate of another fact (`base_fact_entity_id`): never itself (CHECK), a live fact and no cycle (the domain's
-- checks); deleting the base's entity clears it in the same change group (the domain, AD-23). A dimension has a kind
-- (standard or junk; an outrigger is derived from relationships, never stored) and a history that replaces the SCD type:
-- keep (0), overwrite (1), history (2) or snapshot, with a snapshot period kept whatever the history.
-- No database holds data yet (AD-31); the updates convert rows all the same. The local data file's older rows are
-- converted when the file is loaded (`TableRules.upgrade`, src/modules/infocube/data/tables.ts).

alter table cube_entity add column fact_type text;
alter table cube_entity add column is_factless boolean;
alter table cube_entity add column base_fact_entity_id uuid references entity (id);
alter table cube_entity add column dim_kind text;
alter table cube_entity add column history text;
alter table cube_entity add column snapshot_period text;

update cube_entity set fact_type = 'transaction', is_factless = false where role = 'fact';
update cube_entity set dim_kind = 'standard',
  history = case scd_type when 0 then 'keep' when 2 then 'history' else 'overwrite' end
  where role = 'dimension';

alter table cube_entity drop constraint cube_entity_shape_ck;
alter table cube_entity drop column scd_type;

alter table cube_entity add constraint cube_entity_fact_type_ck
  check (fact_type is null or fact_type in ('transaction', 'periodic', 'accumulating'));
alter table cube_entity add constraint cube_entity_dim_kind_ck check (dim_kind is null or dim_kind in ('standard', 'junk'));
alter table cube_entity add constraint cube_entity_history_ck
  check (history is null or history in ('keep', 'overwrite', 'history', 'snapshot'));
alter table cube_entity add constraint cube_entity_base_ck check (base_fact_entity_id is null or base_fact_entity_id <> entity_id);
alter table cube_entity add constraint cube_entity_shape_ck check (
  (role = 'fact' and fact_type is not null and is_factless is not null
     and dim_kind is null and history is null and snapshot_period is null)
  or (role = 'dimension' and grain is null and fact_type is null and is_factless is null
     and base_fact_entity_id is null and dim_kind is not null and history is not null));
create index cube_entity_base_ix on cube_entity (base_fact_entity_id);
