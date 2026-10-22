import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

// Layer rules from CLAUDE.md (AD-19):
//   app -> canvas -> ui -> domain (canvas may also import domain; ui never imports canvas)
//   app -> data -> domain
//   domain imports nothing from the other layers, and no React, Next.js or storage code.
const layers = ["domain", "data", "app", "ui", "canvas"];

// The domain is pure TypeScript. These patterns also catch imports of files that do not exist yet.
const pureDomain = {
  group: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*", "@supabase/*"],
  message: "src/domain is pure TypeScript: no React, Next.js or database code (AD-19).",
};
const noStorage = {
  group: ["fs", "fs/*", "node:fs", "node:fs/*"],
  message: "src/domain does not touch storage; use src/data (AD-19).",
};
const noOtherLayers = {
  // Climbing out with ../ or using the @/ alias to reach another layer. (So src/domain must not have
  // folders or files of its own named data, app, ui or canvas; ./canvas within a folder is fine.)
  regex: "^(@/|(\\.\\./)+)(data|app|ui|canvas)(/|$)",
  message: "src/domain imports nothing from the other layers (AD-19).",
};
const SAMPLES = "Import samples are for tests only (slice 7a, P10: no samples in the app).";
const noSamples = { group: ["**/import/samples", "**/import/samples/**"], message: SAMPLES };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      // src/proxy.ts (Next.js wants it next to src/app) is not a layer; it imports src/app/_lib and the measurement gate
      // in src/data/local/measure-mode.ts (AD-31).
      "boundaries/elements": layers.map((type) => ({ type, pattern: `src/${type}/**`, partialMatch: false })),
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message: "Layer rule (AD-19): '{{from.type}}' may not import from '{{to.type}}'. See CLAUDE.md.",
          policies: [
            { allow: { to: { module: { origin: ["external", "core"] } } } },
            { from: { element: { type: "domain" } }, allow: { to: { element: { type: "domain" } } } },
            { from: { element: { type: "data" } }, allow: { to: { element: { types: { anyOf: ["data", "domain"] } } } } },
            { from: { element: { type: "ui" } }, allow: { to: { element: { types: { anyOf: ["ui", "domain"] } } } } },
            { from: { element: { type: "canvas" } }, allow: { to: { element: { types: { anyOf: ["canvas", "ui", "domain"] } } } } },
            { from: { element: { type: "app" } }, allow: { to: { element: { types: { anyOf: layers } } } } },
          ],
        },
      ],
    },
  },
  {
    // Import samples (slice 7a, P10): test files only. Outside tests nothing in src/ imports or names them, so they
    // never reach a bundle (tests/ and e2e/ read them from disk).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noSamples] }],
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/import[\\\\/]samples/]", message: SAMPLES },
        { selector: "TemplateElement[value.raw=/import[\\\\/]samples/]", message: SAMPLES },
      ],
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    ignores: ["src/domain/**/*.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [pureDomain, noStorage, noOtherLayers, noSamples] }] },
  },
  {
    // Domain tests may read their test files (the import samples) from disk.
    files: ["src/domain/**/*.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [pureDomain, noOtherLayers] }] },
  },
  globalIgnores([
    ".next/**",
    ".next-e2e*/**",
    ".next-measure/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "spikes/**",
    "docs/**",
    "playwright-report/**",
    "test-results/**",
    // local data, measurements and their scratch scripts (git-ignored, AD-29)
    ".data/**",
  ]),
]);

export default eslintConfig;
