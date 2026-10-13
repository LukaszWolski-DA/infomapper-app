import { describe, expect, it } from "vitest";
import { plainTextPair, shownHtml } from "./plain-text";

describe("plainTextPair (AD-30)", () => {
  it("stores paragraphs and line breaks as escaped HTML next to the text", () => {
    expect(plainTextPair("A <b>customer</b> & co.\nSecond line\n\nNew paragraph")).toEqual({
      html: "<p>A &lt;b&gt;customer&lt;/b&gt; &amp; co.<br>Second line</p><p>New paragraph</p>",
      text: "A <b>customer</b> & co.\nSecond line\n\nNew paragraph",
    });
  });

  it("trims, normalises Windows line ends and turns empty text into nulls", () => {
    expect(plainTextPair("  one\r\ntwo  ")).toEqual({ html: "<p>one<br>two</p>", text: "one\ntwo" });
    expect(plainTextPair("   ")).toEqual({ html: null, text: null });
    expect(plainTextPair(null)).toEqual({ html: null, text: null });
  });

  it("escapes quotes so the HTML stays inert", () => {
    expect(plainTextPair(`"x" 'y'`).html).toBe("<p>&quot;x&quot; &#39;y&#39;</p>");
  });
});

describe("shownHtml (slice 4a, step 2 point 1)", () => {
  const legacy = "a < b & <img src=x onerror=alert(1)>";

  it("a plain-text definition stored before slice 4a is shown as text in paragraphs, never as HTML", () => {
    const stored = plainTextPair(legacy);
    expect(stored.html).toBe("<p>a &lt; b &amp; &lt;img src=x onerror=alert(1)&gt;</p>");
    expect(shownHtml(stored.html, stored.text)).toBe(stored.html);
  });

  it("a row with only its plain text (no html) is escaped too", () => {
    expect(shownHtml(null, legacy)).toBe("<p>a &lt; b &amp; &lt;img src=x onerror=alert(1)&gt;</p>");
    expect(shownHtml("", "line one\nline two")).toBe("<p>line one<br>line two</p>");
    expect(shownHtml(null, null)).toBeNull();
  });
});
