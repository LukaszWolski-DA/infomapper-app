// The domain's description of the stored tables, for the AD-31 schema check: the row types in src/domain/types.ts,
// one per table as the local adapter's `DevDb` lists them (src/data/local/schema.ts). Read with the TypeScript
// compiler, so there is no second list of columns to keep in step.
//
// A property's declared type gives the column: `Uuid` → uuid, `Timestamp` → timestamptz, strings and string-literal
// unions → text, numbers → number, `boolean` → boolean, objects (`CanvasLook`, `RowImage`) → jsonb; `| null` makes it
// nullable.

import path from "node:path";
import ts from "typescript";
import type { ColumnKind, ColumnShape, TableShape } from "./compare-schema";

const ROOT = path.resolve(__dirname, "../..");
export const DEV_DB_FILE = path.join(ROOT, "src/data/local/schema.ts");

/** Type aliases whose name tells the column type (both are `string` to TypeScript). */
const NAMED: Record<string, ColumnKind> = { Uuid: "uuid", Timestamp: "timestamptz" };

interface Found {
  kinds: Set<ColumnKind>;
  nullable: boolean;
}

export function domainTables(file = DEV_DB_FILE, interfaceName = "DevDb"): TableShape[] {
  const program = ts.createProgram([file], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: ROOT,
    paths: { "@/*": ["./src/*"] },
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`Cannot read ${file}`);
  const db = source.statements.find((s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === interfaceName);
  if (!db) throw new Error(`No interface ${interfaceName} in ${file}`);

  const tables: TableShape[] = [];
  for (const table of checker.getPropertiesOfType(checker.getTypeAtLocation(db))) {
    if (table.name === "format") continue;
    const arrayType = checker.getTypeOfSymbolAtLocation(table, db);
    const row = checker.getIndexTypeOfType(arrayType, ts.IndexKind.Number);
    if (!row) throw new Error(`${interfaceName}.${table.name} is not an array of rows`);
    const columns = checker.getPropertiesOfType(row).map((column): ColumnShape => {
      const decl = column.valueDeclaration;
      if (!decl || !ts.isPropertySignature(decl) || !decl.type) throw new Error(`${table.name}.${column.name}: no declared type`);
      const found: Found = { kinds: new Set(), nullable: !!decl.questionToken };
      fromNode(decl.type, checker, found);
      if (found.kinds.size !== 1) {
        throw new Error(`${table.name}.${column.name}: cannot tell one column type from "${decl.type.getText()}" (${[...found.kinds].join(", ") || "none"})`);
      }
      return { name: column.name, kind: [...found.kinds][0]!, nullable: found.nullable };
    });
    tables.push({ table: table.name, columns });
  }
  return tables;
}

function fromNode(node: ts.TypeNode, checker: ts.TypeChecker, found: Found): void {
  if (ts.isUnionTypeNode(node)) {
    for (const t of node.types) fromNode(t, checker, found);
    return;
  }
  if (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword) {
    found.nullable = true;
    return;
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && NAMED[node.typeName.text]) {
    found.kinds.add(NAMED[node.typeName.text]!);
    return;
  }
  fromType(checker.getTypeFromTypeNode(node), found);
}

function fromType(type: ts.Type, found: Found): void {
  const f = type.flags;
  if (f & ts.TypeFlags.Null) found.nullable = true;
  else if (f & ts.TypeFlags.BooleanLike) found.kinds.add("boolean");
  else if (f & ts.TypeFlags.StringLike) found.kinds.add("text");
  else if (f & ts.TypeFlags.NumberLike) found.kinds.add("number");
  else if (type.isUnion()) for (const t of type.types) fromType(t, found);
  else if (f & ts.TypeFlags.Object) found.kinds.add("jsonb");
}
