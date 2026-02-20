import { describe, it, expect } from "vitest";
import { transformToKepub } from "./kepub.js";

const SIMPLE_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <p>Hello world</p>
  <p>Second paragraph</p>
</body>
</html>`;

const NESTED_INLINE_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <p>This is <b>bold</b> and <i>italic</i> text.</p>
</body>
</html>`;

const CODE_BLOCK_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <p>Before code</p>
  <pre><code>const x = 42;</code></pre>
  <p>After code</p>
</body>
</html>`;

const WHITESPACE_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <p>Content</p>

  <p>More content</p>
</body>
</html>`;

describe("transformToKepub", () => {
  it("should wrap text nodes in koboSpan", () => {
    const result = transformToKepub(SIMPLE_XHTML, 1);
    expect(result).toContain('class="koboSpan"');
    expect(result).toContain('id="kobo.1.1"');
    expect(result).toContain('id="kobo.1.2"');
  });

  it("should wrap nested inline text nodes", () => {
    const result = transformToKepub(NESTED_INLINE_XHTML, 1);
    expect(result).toContain('class="koboSpan"');
    // Should wrap "This is ", "bold", " and ", "italic", " text."
    expect(result).toContain("kobo.1.1");
    expect(result).toContain("kobo.1.2");
  });

  it("should NOT wrap text inside code blocks", () => {
    const result = transformToKepub(CODE_BLOCK_XHTML, 1);
    // "Before code" and "After code" should be wrapped
    expect(result).toContain("kobo.1.1");
    expect(result).toContain("kobo.1.2");
    // "const x = 42;" should NOT be wrapped
    expect(result).not.toMatch(/kobo\.1\.\d+"[^>]*>const x = 42;/);
  });

  it("should NOT wrap whitespace-only text nodes", () => {
    const result = transformToKepub(WHITESPACE_XHTML, 1);
    // Should only wrap "Content" and "More content"
    expect(result).toContain("kobo.1.1");
    expect(result).toContain("kobo.1.2");
    expect(result).not.toContain("kobo.1.3");
  });

  it("should wrap body in book-inner > book-columns", () => {
    const result = transformToKepub(SIMPLE_XHTML, 1);
    expect(result).toContain('class="book-inner"');
    expect(result).toContain('class="book-columns"');
  });

  it("should have xmlns on root element", () => {
    const result = transformToKepub(SIMPLE_XHTML, 1);
    expect(result).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it("should output valid XML declaration", () => {
    const result = transformToKepub(SIMPLE_XHTML, 1);
    expect(result).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it("should use chapter index for span IDs", () => {
    const result = transformToKepub(SIMPLE_XHTML, 3);
    expect(result).toContain("kobo.3.1");
    expect(result).toContain("kobo.3.2");
  });

  it("should not double-wrap existing koboSpan nodes", () => {
    const alreadyWrapped = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <p><span class="koboSpan" id="kobo.1.1">Already wrapped</span></p>
</body>
</html>`;
    const result = transformToKepub(alreadyWrapped, 1);
    // Should not create a nested koboSpan inside existing koboSpan
    const matches = result.match(/koboSpan/g);
    expect(matches?.length).toBe(1);
  });
});
