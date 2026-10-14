import { describe, expect, it } from "vitest";
import { REQUIREMENT_KINDS } from "../types";
import { REQUIREMENT_TEMPLATES, templateHtml } from "./requirement-templates";
import { sanitizeRich } from "./rich-text";

describe("requirement templates (D-44, PRD item 17)", () => {
  it("has the prototype's sections for every kind", () => {
    expect(REQUIREMENT_KINDS.map((k) => REQUIREMENT_TEMPLATES[k].length)).toEqual([6, 7, 6, 6, 4]);
    expect(REQUIREMENT_TEMPLATES.business_rule[0]).toEqual(["The rule in words", "One or two sentences a business user would agree with"]);
  });

  it("gives each section a heading and an empty paragraph carrying its hint", () => {
    expect(templateHtml("non_functional")).toBe(
      '<h4>Category</h4><p data-ph="Security, performance, retention, compliance, availability"></p>' +
        '<h4>Measurable requirement</h4><p data-ph="A number or a condition that can be tested"></p>' +
        '<h4>Reason or regulation</h4><p data-ph="Why it is needed, e.g. a GDPR article or an internal policy"></p>' +
        '<h4>How it is verified</h4><p data-ph="Test, audit, monitoring or sign-off"></p>',
    );
  });

  it("an untouched template stores nothing; written sections keep their headings and text, no hints", () => {
    expect(sanitizeRich(templateHtml("business_rule"))).toEqual({ html: null, text: null });
    const written = templateHtml("business_rule")
      .replace('<p data-ph="One or two sentences a business user would agree with"></p>', '<p data-ph="One or two sentences a business user would agree with">Total equals the <strong>sum</strong>.</p>')
      .replace('<p data-ph="Document, policy or person who owns it"></p>', "<p>Finance policy 4.2</p>");
    expect(sanitizeRich(written)).toEqual({
      html: "<h4>The rule in words</h4><p>Total equals the <strong>sum</strong>.</p><h4>Source of the rule</h4><p>Finance policy 4.2</p>",
      text: "The rule in words\n\nTotal equals the sum.\n\nSource of the rule\n\nFinance policy 4.2",
    });
  });
});
