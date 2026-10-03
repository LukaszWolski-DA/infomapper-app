# src/domain

Pure TypeScript: types, commands, validation, business rules. No React, no Next.js, no database (AD-19).
Unit tests (`*.test.ts`) live next to the code.

- `commands/`: one file per area; each command checks permission, input, version, and returns a write set.
- `model/`: model rules used by commands and screens (type check, mapping rules, delete impact, concept colours).
