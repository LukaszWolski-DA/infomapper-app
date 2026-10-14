import { describe, expect, it } from "vitest";
import { plainTextPair } from "./plain-text";
import { sanitizeRich } from "./rich-text";

describe("sanitizeRich (AD-17, PRD item 11)", () => {
  it("keeps the allow-list: paragraphs, breaks, bold, italic, lists, sup, sub, headings, links and colour spans", () => {
    const html =
      '<h4>Rule</h4><p>Total <strong>equals</strong> the <em>sum</em> of x<sup>2</sup> and y<sub>1</sub>.<br>Next line.</p>' +
      '<ul><li>one</li><li>two</li></ul><ol><li>three</li></ol>' +
      '<p><a href="https://example.com/a?b=1&amp;c=2">link</a> <span class="tc-warn">warning</span></p>';
    expect(sanitizeRich(html).html).toBe(
      '<h4>Rule</h4><p>Total <strong>equals</strong> the <em>sum</em> of x<sup>2</sup> and y<sub>1</sub>.<br>Next line.</p>' +
        '<ul><li>one</li><li>two</li></ul><ol><li>three</li></ol>' +
        '<p><a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener">link</a> <span class="tc-warn">warning</span></p>',
    );
  });

  it("turns b, i and div into strong, em and p, as the prototype does", () => {
    expect(sanitizeRich("<div><b>bold</b> and <i>italic</i></div>").html).toBe("<p><strong>bold</strong> and <em>italic</em></p>");
  });

  it("keeps the text of any other element and drops the element and every attribute it is not allowed", () => {
    expect(sanitizeRich('<p onclick="alert(1)" style="color:red" class="x">Hi <u>there</u> <font color="red">you</font></p>').html).toBe("<p>Hi there you</p>");
    // a table closes the paragraph before it, as in a browser; its cells keep their text
    expect(sanitizeRich("<table><tr><td>cell</td><td>two</td></tr></table>").html).toBe("<p>celltwo</p>");
    expect(sanitizeRich('<p><strong onmouseover="x()">a</strong><img src=x onerror="alert(1)">b</p>').html).toBe("<p><strong>a</strong>b</p>");
  });

  it("drops script, style, iframe, object, embed, svg, math, template and noscript with their content", () => {
    const html =
      "<p>a</p><script>alert(1)</script><style>p{}</style><iframe src='x'>in</iframe><object>o</object><embed src=x>" +
      "<svg><text>s</text></svg><math><mi>m</mi></math><template>t</template><noscript>n</noscript><p>b</p>";
    expect(sanitizeRich(html)).toEqual({ html: "<p>a</p><p>b</p>", text: "a\n\nb" });
  });

  it("keeps only http, https and mailto links; others keep their text without the link", () => {
    expect(sanitizeRich('<p><a href="javascript:alert(1)">x</a></p>').html).toBe("<p>x</p>");
    expect(sanitizeRich('<p><a href=" JavaScript:alert(1)">x</a></p>').html).toBe("<p>x</p>");
    expect(sanitizeRich('<p><a href="data:text/html,hi">x</a></p>').html).toBe("<p>x</p>");
    expect(sanitizeRich('<p><a href="mailto:dpo@example.com" target="_self">mail</a></p>').html).toBe(
      '<p><a href="mailto:dpo@example.com" target="_blank" rel="noopener">mail</a></p>',
    );
  });

  it("keeps a span only with one of the four colour classes", () => {
    expect(sanitizeRich('<p><span class="big tc-ok">ok</span><span class="tc-red">no</span><span>plain</span></p>').html).toBe(
      '<p><span class="tc-ok">ok</span>noplain</p>',
    );
  });

  it("never stores template hints: empty paragraphs and headings followed by nothing go", () => {
    const html = '<h4>Rule</h4><p class="ph" data-ph="Write the rule"></p><h4>Example</h4><p>An example.</p><h4>Exceptions</h4><p> </p>';
    expect(sanitizeRich(html).html).toBe("<h4>Example</h4><p>An example.</p>");
  });

  it("stores null in both columns for empty content", () => {
    for (const empty of [null, undefined, "", "<p></p>", "<p> </p><h4>Rule</h4>", "<script>x</script>", "<br>"]) {
      expect(sanitizeRich(empty)).toEqual({ html: null, text: null });
    }
  });

  it("derives the plain text: blocks separated by a blank line, list items and breaks by a newline, entities decoded", () => {
    expect(sanitizeRich("<h4>Rule</h4><p>a &amp; b<br>c</p><ul><li>one</li><li>two</li></ul>").text).toBe("Rule\n\na & b\nc\n\none\ntwo");
  });

  it("escapes text again when writing it back", () => {
    expect(sanitizeRich("<p>1 &lt; 2 &amp;&amp; &lt;b&gt;</p>").html).toBe("<p>1 &lt; 2 &amp;&amp; &lt;b&gt;</p>");
  });

  it("wraps loose text in a paragraph and gives a plain-text definition stored before slice 4a the same pair", () => {
    expect(sanitizeRich("Just text").html).toBe("<p>Just text</p>");
    const before = plainTextPair("First paragraph.\n\nSecond line one\nline two");
    expect(sanitizeRich(before.html)).toEqual(before);
  });
});
