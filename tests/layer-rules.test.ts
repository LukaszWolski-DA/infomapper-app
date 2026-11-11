import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Checks the layer rule from CLAUDE.md (AD-19, S0-12): src/domain may not import other layers or React. Slice 15a
// (AD-33, S15-01): InfoMapper's layers never import a module, a module's parts follow the same directions, and only
// src/app imports the composition root (src/compose/).
const eslint = new ESLint();

async function lintFile(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId);
}
const lintDomainFile = (code: string) => lintFile("src/domain/__layer_probe__.ts", code);

describe("layer rules", () => {
  it("lets src/domain stay self-contained", async () => {
    expect(await lintDomainFile("export const x = 1;\n")).toEqual([]);
  });

  it("refuses an import from src/data in src/domain", async () => {
    expect(await lintDomainFile('import "../data/ports";\n')).toContain("no-restricted-imports");
  });

  it("refuses React and Next.js in src/domain", async () => {
    expect(await lintDomainFile('import "react";\n')).toContain("no-restricted-imports");
    expect(await lintDomainFile('import "next/server";\n')).toContain("no-restricted-imports");
  });
}, 60_000);

describe("module boundary (slice 15a, S15-01)", () => {
  const MODULE_IMPORT = 'import { CUBE_ROLES } from "@/modules/infocube/domain/types";\nexport const x = CUBE_ROLES;\n';
  const COMPOSE_IMPORT = 'import { UNDO_TABLES } from "@/compose";\nexport const x = UNDO_TABLES;\n';

  it("refuses a module import in each of InfoMapper's layers", async () => {
    for (const layer of ["domain", "data", "ui", "canvas", "app"]) {
      expect(await lintFile(`src/${layer}/__module_probe__.ts`, MODULE_IMPORT), layer).toContain("boundaries/dependencies");
    }
    expect(await lintDomainFile(MODULE_IMPORT)).toContain("no-restricted-imports");
  });

  it("lets only src/app import the composition root", async () => {
    expect(await lintFile("src/app/__compose_probe__.ts", COMPOSE_IMPORT)).toEqual([]);
    for (const layer of ["domain", "data", "ui", "canvas"]) {
      expect(await lintFile(`src/${layer}/__compose_probe__.ts`, COMPOSE_IMPORT), layer).toContain("boundaries/dependencies");
    }
    expect(await lintFile("src/modules/infocube/app/__compose_probe__.ts", COMPOSE_IMPORT)).toContain("boundaries/dependencies");
  });

  it("lets the composition root import a module", async () => {
    expect(await lintFile("src/compose/__probe__.ts", MODULE_IMPORT)).toEqual([]);
  });

  it("keeps a module's domain part pure", async () => {
    const at = "src/modules/infocube/domain/__probe__.ts";
    expect(await lintFile(at, 'import type { Uuid } from "@/domain/ids";\nexport type X = Uuid;\n')).toEqual([]);
    expect(await lintFile(at, 'import "react";\n')).toContain("no-restricted-imports");
    expect(await lintFile(at, 'import "@/data/local/schema";\n')).toEqual(expect.arrayContaining(["no-restricted-imports", "boundaries/dependencies"]));
    expect(await lintFile(at, 'import "../data/tables";\n')).toEqual(expect.arrayContaining(["no-restricted-imports", "boundaries/dependencies"]));
  });

  it("lets a module's parts import InfoMapper's layers only in the allowed direction", async () => {
    expect(await lintFile("src/modules/infocube/data/__probe__.ts", 'import "@/data/local/schema";\n')).toEqual([]);
    expect(await lintFile("src/modules/infocube/data/__probe__.ts", 'import "@/app/_lib/run-command";\n')).toContain("boundaries/dependencies");
    expect(await lintFile("src/modules/infocube/ui/__probe__.ts", 'import "@/canvas/context";\n')).toContain("boundaries/dependencies");
    expect(await lintFile("src/modules/infocube/app/__probe__.ts", 'import "@/app/_lib/run-command";\n')).toEqual([]);
  });
}, 120_000);

describe("two modules (slice 25, step 1's F8)", () => {
  const DOC_IMPORT = 'import { DOCUMENT_PRESETS } from "@/modules/infodocumenter/domain/types";\nexport const x = DOCUMENT_PRESETS;\n';
  const CUBE_IMPORT = 'import { CUBE_ROLES } from "@/modules/infocube/domain/types";\nexport const y = CUBE_ROLES;\n';
  const CONTRACT = 'import { sectionKinds } from "@/domain/document/sections";\nexport const x = sectionKinds;\n';

  it("refuses InfoDocumenter in each of InfoMapper's layers", async () => {
    for (const layer of ["domain", "data", "ui", "canvas", "app"]) {
      expect(await lintFile(`src/${layer}/__module_probe__.ts`, DOC_IMPORT), layer).toContain("boundaries/dependencies");
    }
  });

  it("refuses an import of one module in every part of the other", async () => {
    for (const part of ["domain", "data", "ui", "canvas", "app"]) {
      expect(await lintFile(`src/modules/infocube/${part}/__probe__.ts`, DOC_IMPORT), `infocube ${part}`).toContain("boundaries/dependencies");
      expect(await lintFile(`src/modules/infodocumenter/${part}/__probe__.ts`, CUBE_IMPORT), `infodocumenter ${part}`).toContain("boundaries/dependencies");
    }
  });

  it("lets both modules' domain parts read the section contract, and the composition root both modules", async () => {
    expect(await lintFile("src/modules/infocube/domain/__probe__.ts", CONTRACT)).toEqual([]);
    expect(await lintFile("src/modules/infodocumenter/domain/__probe__.ts", CONTRACT)).toEqual([]);
    expect(await lintFile("src/compose/__probe__.ts", DOC_IMPORT + CUBE_IMPORT)).toEqual([]);
  });

  it("keeps InfoDocumenter's domain part pure", async () => {
    const at = "src/modules/infodocumenter/domain/__probe__.ts";
    expect(await lintFile(at, 'import "react";\n')).toContain("no-restricted-imports");
    expect(await lintFile(at, 'import "../data/tables";\n')).toEqual(expect.arrayContaining(["no-restricted-imports", "boundaries/dependencies"]));
  });
}, 120_000);
