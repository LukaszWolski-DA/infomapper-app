# InfoDocumenter: ideas

Notes from a discussion with Łukasz on 7 November 2026 (slice 16a thread, extensive tests). Nothing here is decided
beyond the first section; it is a starting point for a later PRD.

## Decided (Łukasz, 7 November 2026)

- InfoDocumenter is a **separate product with its own licence**, not a module of InfoMapper: InfoMapper is already large
  and has much left to do.
- Anyone with access to the organization and the licence may create documents and diagrams: the client or the modeller.
- Word first; the client's documents in English, German names through aliases.

## What the pilot taught

A pilot built one client's documentation from a local data file with scripts (`.data/exports/docs/tools/`, git-ignored;
its `README.md` has the commands and the decisions). Every remark during the review was about **structure and content**,
never about the data:

- the order of the chapters (sources before the model overview);
- what to show and in how much detail (sources as a list of tables with a diagram, no column tables; mapping tables,
  no mapping diagrams; no appendix of aliases);
- which cells the client should complete (alias, definition, description in yellow);
- how diagrams look (a concept's diagram without its frame; the legend drawn with the canvas's own marks).

Each remark meant a change in code. **The main rule: a document's layout is configuration, not code.**

## Layers

```
InfoMapper (model)  →  snapshot  →  template (blocks + parameters)  →  content tree  →  renderers (Word, PDF, HTML)
                                                                                       ↑ the client's branding
```

1. **Model snapshot.** Read only, versioned, with the model state it was taken at (e.g. the last change group). Stored
   with the document, so a document can be produced again and "What changed since version 0.1" is the difference of
   two snapshots.
2. **Template of blocks.** A list of blocks with parameters, e.g. `SourcesList(systems, showColumns)`,
   `SourceDiagram(canvas)`, `ConceptDiagram(frames: false)`, `EntityFacts`,
   `AttributeTable(columns, ask: [alias, definition])`, `MappingTable(status)`, `DimensionalSummary`, `FreeText`. Saved
   per client or project and reused for the next release; a template can be locked as the organization's standard.
3. **Content tree.** Neutral: headings, paragraphs, tables, figures, cells to complete. Blocks know nothing about Word.
4. **Renderers.** Word first (the pilot used the `docx` package), then PDF and HTML. Branding (logo, fonts, colours,
   footer) is a .dotx or organization settings, not code. Note: the pilot updated the table of contents through Word
   (COM); a server has no Word, so the contents need another way (fields updated on open, or computed).

## What InfoMapper gives (as little as possible)

1. **A read contract:** one endpoint "the model of workspace X" as JSON in a published, versioned schema
   (`model-snapshot v1`): concepts, entities, attributes, relationships, sources, mappings, InfoCube and the canvases'
   layout, with the state marker. Read **as the signed-in person**, never with a service key: a client sees in a
   document only what they may read in InfoMapper.
2. **A print SVG of a canvas** (optional, when screenshots start to hurt): a route like the thumbnails (slice 12b,
   AD-32) for a canvas, a frame or a set of cards, without working marks. The card and line geometry stays in one place
   (`src/canvas/geometry.ts`: `ieMarker`, card heights); a copy in InfoDocumenter would drift with every canvas change.
3. **Later: proposals.** What the client fills in comes back as proposals to review in InfoMapper, like the changes to
   resolve (D-56) with four-eyes; InfoMapper stays the only place that writes the model (AD-23).

Shared by both products: one sign-in, the same organizations and people (natural with Supabase, AD-31), a licence per
organization and product (as InfoCube's licence).

## The client's feedback loop

The yellow cells become Word content controls tagged with the object (e.g. `attribute:<id>:definition`). The client
fills them in Word and sends the file back; InfoDocumenter reads the .docx and turns the entries into proposals for
InfoMapper. Nothing is retyped by hand.

## Names and languages

The template's own texts ("Primary key", "Relationships") from a translation catalogue; object names by the names /
aliases rule of slice 11 (D-64): the same model gives an English or a German document.

## Quality before release

The pilot's checklist as a gate before a document is released: internal notes in definitions (MOCK, verify with SME,
assumed), entities without a definition or a primary key, concepts without a description, attributes without a
definition, and inconsistencies (e.g. a mapping rule that casts to another type than the attribute's). Releases are
versioned (0.1 draft, 0.2, …) with their history.

## Diagrams

- Pilot: screenshots of the running app (Playwright on a second server with a copy of the data, working marks hidden
  with CSS, regions computed from the cards). Works, but needs a running server and is brittle.
- Target: SVG from InfoMapper's print route (above): vector, sharp at any zoom, any region (canvas, frame, concept,
  set of cards).

## A possible order

1. InfoMapper: one small slice with the snapshot contract (schema and endpoint with permissions). Until then the pilot
   reads the local file.
2. InfoDocumenter MVP: a new repository; a template in a file (no editor), the pilot's blocks, Word.
3. InfoMapper: the print SVG, when screenshots get in the way.
4. InfoDocumenter: the template editor with preview, document versions, the checklist as a gate.
5. Both: the feedback loop from Word.

## Open questions

- Does the snapshot contract come before the database slice (AD-31) or with it?
- Who maintains the organization's standard templates, and may a client change them or only copy them?
- Which renderer after Word: PDF directly, or HTML (discussed on 7 November: for this client HTML adds little)?
