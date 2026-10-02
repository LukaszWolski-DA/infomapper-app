import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Checks the layer rule from CLAUDE.md (AD-19, S0-12): src/domain may not import other layers or React.
const eslint = new ESLint();

async function lintDomainFile(code: string) {
  const [result] = await eslint.lintText(code, { filePath: "src/domain/__layer_probe__.ts" });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId);
}

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
