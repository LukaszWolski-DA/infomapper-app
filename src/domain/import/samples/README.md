# Import samples (slice 7a, P10)

Test files only: unit tests and e2e specs read them from disk. No application code imports them, and they never reach
the client bundle (`eslint.config.mjs`, "import samples"). The app has no sample links; people test with their own files.

| File | What | From |
| --- | --- | --- |
| `crm_snapshot_2026-10-20.csv` | the standard, CRM (changed against the demo CRM) | prototype `SAMPLE_CRM` |
| `hr_snapshot_2026-10-20.csv` | the standard, HR | prototype `SAMPLE_HR` |
| `reference_files.csv` | the standard, flat files | prototype `SAMPLE_FILES` |
| `billing.sql` | DDL, SQL Server (SSMS script) | prototype `DDL_SAMPLES.mssql` |
| `loyalty_schema.sql` | DDL, PostgreSQL (pg_dump), database `loyaltydb` | prototype `DDL_SAMPLES.postgres` |
| `hrleg_ddl.sql` | DDL, Oracle (DBMS_METADATA), database `ORCL` | prototype `DDL_SAMPLES.oracle` |
| `crm_sqlserver_catalog.tsv` | the SQL Server catalog query's result as SSMS copies it (tabs, `NULL` cells): the demo CRM unchanged | S7A-16 |
| `web_postgres_catalog.csv` | the PostgreSQL query's result as psql's `\copy … CSV HEADER` writes it: the demo WEB unchanged | S7A-16 |
| `hr_oracle_catalog.csv` | the Oracle query's result as SQL Developer exports it (quoted, upper case) | S7A-16 |

The first six were written from the prototype's own code (`toCSV`, `sampleRows`), so they match it byte for byte apart
from a final line break.
