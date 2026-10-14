// Requirement description templates (D-44, D-45; slice 4a, PRD item 17), built in per kind as the prototype's
// `RTEMPLATES`. Section headings are content; each hint is a grey placeholder in the editor that vanishes as you type
// and is never saved (the server drops empty sections, `sanitizeRich`).

import type { RequirementKind } from "../types";

export type TemplateSection = readonly [heading: string, hint: string];

export const REQUIREMENT_TEMPLATES: Record<RequirementKind, readonly TemplateSection[]> = {
  need: [
    ["Context and problem", "What is not working today, and for whom?"],
    ["Who needs it", "Teams, roles or reports that will use the result"],
    ["Goal and measure of success", "How will we know it works, e.g. churn report ready by day 3 of the month"],
    ["Scope", "What is in, and explicitly what is out"],
    ["Related processes and reports", "Processes, dashboards or regulatory reports this feeds"],
    ["Assumptions and constraints", "What we take for granted; deadlines, budgets, systems we cannot change"],
  ],
  data: [
    ["Data needed", "Which facts about which things, in business words"],
    ["Sources", "Systems and tables expected to provide it"],
    ["Granularity", "One row per what, e.g. per order line per day"],
    ["History", "Keep changes over time? How long? Point-in-time views needed?"],
    ["Freshness", "How often refreshed, and the acceptable delay"],
    ["Completeness", "What may be missing, and what must never be"],
    ["Acceptance criteria", "Checks that prove the data is right, e.g. totals reconcile with the ERP ledger"],
  ],
  business_rule: [
    ["The rule in words", "One or two sentences a business user would agree with"],
    ["Input data", "Attributes and sources the rule reads"],
    ["Logic, step by step", "How the result is calculated or decided"],
    ["Edge cases and exceptions", "Empty values, zeros, currencies, rounding, cancelled records"],
    ["Examples", "Input → expected result, including at least one edge case"],
    ["Source of the rule", "Document, policy or person who owns it"],
  ],
  dq_rule: [
    ["What is checked", "Completeness, uniqueness, validity, consistency or timeliness"],
    ["Scope", "Attributes and tables the check covers"],
    ["Condition for valid data", "When a record passes, in words"],
    ["Tolerance", "How many failures are acceptable before it counts as broken"],
    ["Who fixes failures", "Owner in the source system or the data team"],
    ["Examples of bad data", "Real or typical records that should fail"],
  ],
  non_functional: [
    ["Category", "Security, performance, retention, compliance, availability"],
    ["Measurable requirement", "A number or a condition that can be tested"],
    ["Reason or regulation", "Why it is needed, e.g. a GDPR article or an internal policy"],
    ["How it is verified", "Test, audit, monitoring or sign-off"],
  ],
};

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The template as editor content: a heading per section, then an empty paragraph carrying its hint (`data-ph`). */
export const templateHtml = (kind: RequirementKind): string =>
  REQUIREMENT_TEMPLATES[kind].map(([heading, hint]) => `<h4>${escape(heading)}</h4><p data-ph="${escape(hint)}"></p>`).join("");
