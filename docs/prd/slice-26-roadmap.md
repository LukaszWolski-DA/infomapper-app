# InfoDocumenter – roadmap (12 November 2026)

Status after slice 25 (merged, tag `slice-25`, D-80). This file keeps the plan agreed with Łukasz until slice 26's
closing writes it into `docs/ideas.md` (InfoDocumenter, "Later"); after that, `ideas.md` is the one place.

## Done

- **Slice 25 (A):** InfoDocumenter as a module (licence, switch); stored recipes from three presets, private and
  shared with their rights; the form on one page; the document page in A4 by Paged.js (title page, contents with page
  numbers, header, footer, watermark); sections Text, Data dictionary (logical), Source-to-target, InfoCube's
  Dimensional model; English, Polish, German labels; extension points for document sections and the home's module tab.

## Next: slice 26 (B) – the whole editing of the prototype, without figures, versions and logos

Agreed 12 November 2026 (option 2):
- **The editor as in the prototype:** sections on the left (add, remove, reorder), the preview in the middle, the
  options on the right; each section's heading and "start on a new page".
- **All sections without figures:** model overview, readiness (model checks D-75 and the definition's checks),
  conventions and notation, source tables (classifications, notes, Data Vault reading), classification register,
  requirements with descriptions, traceability, data quality rules, the dictionary's other layouts (long texts under the
  row, after the table, in a column) and long definitions at the end; the dictionary's dimensional entities through
  InfoCube's contributions if still needed.
- **Style:** paper, orientation, templates (IBM Plex Serif comes back with them), accent, header and footer fields
  ({org}, {title}, {page}…), minimum font size, keep-rows.
- **The preview (round P):**
  - P1 b: the prototype's editor;
  - P2 d: adaptive. Exact pages refresh by themselves while the last layout took less than a threshold (about 1 s, set
    by step 1's measurement); above it, a quick sheet with "Pages out of date" and "Update pages"; the mode switch
    stays;
  - P3: the quick sheet uses the document's renderer and CSS, page width, a gap where a section starts a new page,
    "–" for page numbers in the contents, title page and watermark present;
  - P4: refresh about 500 ms after the last change, the latest change wins, the old pages stay visible until the new
    ones are laid out; step 1 measures layout time and main-thread long tasks on "Performance test" and the demo;
  - P5: a section clicked on the left scrolls the preview to it; a click in the preview selects the section;
  - P6: no cache of the content tree (12.8 ms for "Performance test").
- Steps: editor and preview → sections → style, each with its report and stop.

## Then (proposed order, to confirm)

1. **Slice C – figures:** canvases and frames as SVG from the canvas's geometry (never screenshots), the star diagram
   drawn from the model, a figure as a reusable block (canvas or frame, 1:1 or fitted, size, orientation, caption),
   list of figures, the canvas's page outline; Paged.js's limits (inline SVG split: figures as `<img>` SVG; mixed page
   sizes).
2. **Baselines** (their own InfoMapper slice; design in `docs/ideas.md`, "Baselines: the design agreed for their
   slice"), then **documents from a baseline** and the section "changes since a baseline".
3. **Slice D – versions and links:** a version stores the generated file (where PDFs are made: browser or server),
   links for people outside the workspace (a new AD: access without a session, expiry, revoke), guests' restriction on
   versions and links (the export setting), logos (organization and client; needs file storage).
4. **Slice E – Markdown export:** metadata instead of images (an AI agent or Mermaid draws the diagrams); one file or a
   set of files (open).

## Later, noted

- Live label canvases in documents from a baseline (option a: freeze the labels and label links that drive them).
- A workspace transfer with baselines holding InfoCube rows (the transfer slice's question).
- Copy and transfer of documents (slice 25 step 1, F30): the author kept when a member of the target, others' private
  documents never copied, scope ids remapped, the licence checked as AD-35 says.
- Module switches and licences as one record when a third module comes.
- Step 2 of figures: a requirement's path from source to dimensional model, a canvas with a requirement's lens,
  cross-references instead of duplicates.

## Follow-ups outside the slices

- **German words** (document labels, InfoCube's words): Łukasz's review, then a small `fix/` branch.
- **Part 8 of the full run:** the longest in the last two GitHub runs (13:53, 16:31); at the next full run, check the
  median of three; if confirmed, recut `PART_STARTS` on a `chore/` branch.
- **KB to format 17:** only on Łukasz's command, after the backup; then a dictionary of Kanton Basel.
- **Paged.js alias** in `next.config.ts`: check at each Paged.js or Next.js upgrade.
