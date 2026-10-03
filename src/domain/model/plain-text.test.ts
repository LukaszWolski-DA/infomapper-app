import { describe, expect, it } from "vitest";
import { plainTextPair } from "./plain-text";

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
