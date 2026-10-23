// The catalog queries of the query channel (slice 7a, PRD item 15; prototype `SQL_SERVER`, `SQL_POSTGRES`,
// `SQL_ORACLE`, `VENDORS`). They read only the catalog, never data, and give InfoMapper's source standard. Unlike the
// prototype, the SQL Server and PostgreSQL queries give fractional seconds as `precision` (`datetime2(7)`,
// `timestamp(3)`), as a DDL script writes them, so a system read from a script and then from the query shows no
// difference that is not real (step 3, question 1). Written from the prototype's own text by a script; edit with care.

export type Vendor = "sqlserver" | "postgres" | "oracle";

export const VENDORS: Readonly<Record<Vendor, { name: string; sql: string; how: string }>> = {
  sqlserver: {
    name: "SQL Server",
    how: "Run it in SSMS or DBeaver in the database you import. Save the grid with headers as CSV, or copy it with headers and paste it.",
    sql: `-- InfoMapper source snapshot, standard v1, SQL Server 2016+
-- Run it in the database you want to import, then save the result
-- with headers as CSV (or copy it with headers and paste it here).
SELECT
  DB_NAME()                                   AS [database],
  s.name                                      AS [schema],
  o.name                                      AS [table],
  CASE o.type WHEN 'U' THEN 'table' ELSE 'view' END AS object_type,
  (SELECT SUM(p.rows) FROM sys.partitions p
    WHERE p.object_id = o.object_id AND p.index_id IN (0, 1)) AS row_count,
  CAST(tep.value AS nvarchar(4000))           AS table_comment,
  c.name                                      AS [column],
  c.column_id                                 AS ordinal,
  t.name                                      AS data_type,
  CASE WHEN t.name IN ('varchar','char','varbinary','binary')
         THEN IIF(c.max_length = -1, 'max', CAST(c.max_length AS varchar(10)))
       WHEN t.name IN ('nvarchar','nchar')
         THEN IIF(c.max_length = -1, 'max', CAST(c.max_length / 2 AS varchar(10)))
  END                                         AS length,
  CASE WHEN t.name IN ('decimal','numeric') THEN c.precision
       WHEN t.name IN ('datetime2','datetimeoffset','time') THEN c.scale END AS precision,
  IIF(t.name IN ('decimal','numeric'), c.scale, NULL)     AS scale,
  IIF(c.is_nullable = 1, 'yes', 'no')         AS nullable,
  IIF(pk.column_id IS NULL, 'no', 'yes')      AS primary_key,
  fk.fk_name, fk.fk_ref_schema, fk.fk_ref_table, fk.fk_ref_column,
  CAST(cep.value AS nvarchar(4000))           AS column_comment,
  CAST(NULL AS nvarchar(200))                 AS classifications
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
JOIN sys.columns c ON c.object_id = o.object_id
JOIN sys.types   t ON t.user_type_id = c.user_type_id
LEFT JOIN (SELECT ic.object_id, ic.column_id
             FROM sys.indexes i
             JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            WHERE i.is_primary_key = 1) pk
       ON pk.object_id = c.object_id AND pk.column_id = c.column_id
OUTER APPLY (SELECT f.name AS fk_name, rs.name AS fk_ref_schema,
                    ro.name AS fk_ref_table, rc.name AS fk_ref_column
               FROM sys.foreign_key_columns fkc
               JOIN sys.foreign_keys f ON f.object_id = fkc.constraint_object_id
               JOIN sys.objects ro ON ro.object_id = fkc.referenced_object_id
               JOIN sys.schemas rs ON rs.schema_id = ro.schema_id
               JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id
                                  AND rc.column_id = fkc.referenced_column_id
              WHERE fkc.parent_object_id = c.object_id
                AND fkc.parent_column_id = c.column_id) fk
LEFT JOIN sys.extended_properties tep
       ON tep.class = 1 AND tep.major_id = o.object_id AND tep.minor_id = 0 AND tep.name = 'MS_Description'
LEFT JOIN sys.extended_properties cep
       ON cep.class = 1 AND cep.major_id = o.object_id AND cep.minor_id = c.column_id AND cep.name = 'MS_Description'
WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
ORDER BY s.name, o.name, c.column_id;
-- A column in two foreign keys gives two rows; the importer reads each as part of its key.`,
  },
  postgres: {
    name: "PostgreSQL",
    how: "Run it in DBeaver or pgAdmin and export as CSV, or in psql: \\copy ( the query without its semicolon ) TO 'snapshot.csv' CSV HEADER.",
    sql: `-- InfoMapper source snapshot, standard v1, PostgreSQL 12+
-- Run it in the database you want to import. Narrow the schemas in WHERE if needed.
-- psql: \\copy ( <this query without the semicolon> ) TO 'snapshot.csv' CSV HEADER
SELECT
  current_database()                              AS "database",
  ns.nspname                                      AS "schema",
  cls.relname                                     AS "table",
  CASE WHEN cls.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS object_type,
  CASE WHEN cls.relkind IN ('v', 'm') OR cls.reltuples < 0 THEN NULL
       ELSE cls.reltuples::bigint END             AS row_count,
  obj_description(cls.oid, 'pg_class')            AS table_comment,
  a.attname                                       AS "column",
  row_number() OVER (PARTITION BY cls.oid ORDER BY a.attnum) AS ordinal,
  CASE t.typname
       WHEN 'varchar' THEN 'varchar'   WHEN 'bpchar' THEN 'char'
       WHEN 'int2' THEN 'smallint'     WHEN 'int4' THEN 'int'      WHEN 'int8' THEN 'bigint'
       WHEN 'float4' THEN 'real'       WHEN 'float8' THEN 'double precision'
       WHEN 'bool' THEN 'boolean'      WHEN 'timestamptz' THEN 'timestamptz'
       ELSE CASE WHEN t.typcategory = 'A' THEN format_type(a.atttypid, NULL) ELSE t.typname END
  END                                             AS data_type,
  CASE WHEN t.typname IN ('varchar', 'bpchar') AND a.atttypmod > 0 THEN a.atttypmod - 4 END AS length,
  CASE WHEN t.typname = 'numeric' AND a.atttypmod > 0 THEN ((a.atttypmod - 4) >> 16) & 65535
       WHEN t.typname IN ('timestamp', 'timestamptz', 'time', 'timetz') AND a.atttypmod >= 0 THEN a.atttypmod END AS "precision",
  CASE WHEN t.typname = 'numeric' AND a.atttypmod > 0 THEN (a.atttypmod - 4) & 65535 END AS scale,
  CASE WHEN a.attnotnull THEN 'no' ELSE 'yes' END AS nullable,
  CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_constraint p
                     WHERE p.conrelid = cls.oid AND p.contype = 'p' AND a.attnum = ANY (p.conkey))
       THEN 'yes' ELSE 'no' END                   AS primary_key,
  fk.fk_name, fk.fk_ref_schema, fk.fk_ref_table, fk.fk_ref_column,
  col_description(cls.oid, a.attnum)              AS column_comment,
  NULL::text                                      AS classifications
FROM pg_catalog.pg_class cls
JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
JOIN pg_catalog.pg_attribute a  ON a.attrelid = cls.oid AND a.attnum > 0 AND NOT a.attisdropped
JOIN pg_catalog.pg_type t       ON t.oid = a.atttypid
LEFT JOIN LATERAL (
  SELECT con.conname AS fk_name, rns.nspname AS fk_ref_schema, rcl.relname AS fk_ref_table, ra.attname AS fk_ref_column
    FROM pg_catalog.pg_constraint con
    CROSS JOIN LATERAL unnest(con.conkey, con.confkey) AS k(src, ref)
    JOIN pg_catalog.pg_class rcl     ON rcl.oid = con.confrelid
    JOIN pg_catalog.pg_namespace rns ON rns.oid = rcl.relnamespace
    JOIN pg_catalog.pg_attribute ra  ON ra.attrelid = con.confrelid AND ra.attnum = k.ref
   WHERE con.contype = 'f' AND con.conrelid = cls.oid AND k.src = a.attnum
) fk ON true
WHERE cls.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND ns.nspname NOT LIKE 'pg_toast%'
  AND NOT cls.relispartition
ORDER BY ns.nspname, cls.relname, a.attnum;
-- A column in two foreign keys gives two rows; the importer reads each as part of its key.`,
  },
  oracle: {
    name: "Oracle",
    how: "Put your schemas in the WHERE clause first. Run it in SQL Developer or DBeaver and export the result with headers as CSV.",
    sql: `-- InfoMapper source snapshot, standard v1, Oracle 12c+
-- Put your schemas in the WHERE clause, run it in SQL Developer or DBeaver,
-- and export the result with headers as CSV.
-- row_count comes from optimizer statistics and can be out of date.
SELECT
  SYS_CONTEXT('USERENV', 'DB_NAME')            AS "database",
  c.owner                                      AS "schema",
  c.table_name                                 AS "table",
  CASE WHEN v.view_name IS NULL THEN 'table' ELSE 'view' END AS "object_type",
  t.num_rows                                   AS "row_count",
  tc.comments                                  AS "table_comment",
  c.column_name                                AS "column",
  c.column_id                                  AS "ordinal",
  c.data_type                                  AS "data_type",
  CASE WHEN c.data_type IN ('VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR') THEN c.char_length
       WHEN c.data_type = 'RAW' THEN c.data_length END AS "length",
  CASE WHEN c.data_type = 'NUMBER' THEN c.data_precision END AS "precision",
  CASE WHEN c.data_type = 'NUMBER' THEN c.data_scale END     AS "scale",
  CASE c.nullable WHEN 'Y' THEN 'yes' ELSE 'no' END          AS "nullable",
  CASE WHEN pk.column_name IS NULL THEN 'no' ELSE 'yes' END  AS "primary_key",
  fk.fk_name                                   AS "fk_name",
  fk.fk_ref_schema                             AS "fk_ref_schema",
  fk.fk_ref_table                              AS "fk_ref_table",
  fk.fk_ref_column                             AS "fk_ref_column",
  cc.comments                                  AS "column_comment",
  CAST(NULL AS VARCHAR2(200))                  AS "classifications"
FROM all_tab_columns c
LEFT JOIN all_tables t       ON t.owner = c.owner AND t.table_name = c.table_name
LEFT JOIN all_views v        ON v.owner = c.owner AND v.view_name = c.table_name
LEFT JOIN all_tab_comments tc ON tc.owner = c.owner AND tc.table_name = c.table_name
LEFT JOIN all_col_comments cc ON cc.owner = c.owner AND cc.table_name = c.table_name
                             AND cc.column_name = c.column_name
LEFT JOIN (SELECT pc.owner, pc.table_name, pc.column_name
             FROM all_constraints p
             JOIN all_cons_columns pc ON pc.owner = p.owner AND pc.constraint_name = p.constraint_name
            WHERE p.constraint_type = 'P') pk
       ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
LEFT JOIN (SELECT fc.owner, fc.table_name, fc.column_name, f.constraint_name AS fk_name,
                  rc.owner AS fk_ref_schema, rc.table_name AS fk_ref_table, rc.column_name AS fk_ref_column
             FROM all_constraints f
             JOIN all_cons_columns fc ON fc.owner = f.owner AND fc.constraint_name = f.constraint_name
             JOIN all_cons_columns rc ON rc.owner = f.r_owner AND rc.constraint_name = f.r_constraint_name
                                     AND rc.position = fc.position
            WHERE f.constraint_type = 'R') fk
       ON fk.owner = c.owner AND fk.table_name = c.table_name AND fk.column_name = c.column_name
WHERE c.owner IN ('CRM')                -- your schemas
  AND c.table_name NOT LIKE 'BIN$%'
ORDER BY c.owner, c.table_name, c.column_id;
-- A column in two foreign keys gives two rows; the importer reads each as part of its key.`,
  },
};
