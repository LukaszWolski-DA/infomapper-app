// A source table's or column's physical name (slice 39, guardrail 4: one rule in InfoMapper's domain for the canvas's
// card, the left panel and InfoCatalog's search and paths).

import type { SourceColumn, SourceTable } from "../types";

type Located = Pick<SourceTable, "database_name" | "schema_name">;

/** Where a table lives: `CRM / crmprod.dbo` ("?" for a system that is gone). */
export const tableLocation = (systemName: string | null | undefined, table: Located): string =>
  `${systemName ?? "?"} / ${table.database_name}.${table.schema_name}`;

/** The full physical name: `CRM / crmprod.dbo.customers`, with a column `CRM / crmprod.dbo.customers.cust_no`. */
export const physicalName = (systemName: string | null | undefined, table: Located & Pick<SourceTable, "name">, column?: Pick<SourceColumn, "name"> | null): string =>
  `${tableLocation(systemName, table)}.${table.name}${column ? `.${column.name}` : ""}`;
