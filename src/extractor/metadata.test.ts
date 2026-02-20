import { describe, it, expect } from "vitest";
import { extractArticle, extractMetadata } from "./metadata.js";

const MOCK_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="My Article by John Doe" />
</head>
<body>
  <div data-testid="twitterArticleReadView">
    <div data-testid="twitterArticleRichTextView">
      <div class="public-DraftStyleDefault-block" data-offset-key="abc">
        <span data-offset-key="abc-0">This is the first paragraph of the article.</span>
      </div>
      <div class="public-DraftStyleDefault-block" data-offset-key="def">
        <span data-offset-key="def-0">This is the second paragraph with some <b>bold text</b>.</span>
      </div>
      <h2 class="longform-header-two">A Heading</h2>
      <div class="public-DraftStyleDefault-block" data-offset-key="ghi">
        <span data-offset-key="ghi-0">More content under the heading.</span>
      </div>
    </div>
  </div>
  <a role="link" href="/johndoe">John Doe</a>
  <a role="link" href="/johndoe">@johndoe</a>
  <time datetime="2026-01-15T10:30:00.000Z">Jan 15</time>
</body>
</html>
`;

const MOCK_ARTICLE_WITH_LISTS = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <div data-testid="twitterArticleReadView">
    <div data-testid="twitterArticleRichTextView">
      <div class="public-DraftStyleDefault-block">
        <span>Introduction paragraph.</span>
      </div>
      <ul>
        <li>Item one</li>
        <li>Item two</li>
        <li>Item three</li>
      </ul>
      <ol>
        <li>First</li>
        <li>Second</li>
      </ol>
    </div>
  </div>
</body>
</html>
`;

const MOCK_ARTICLE_MINIMAL = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <div data-testid="twitterArticleReadView">
    <div data-testid="twitterArticleRichTextView">
      <div class="public-DraftStyleDefault-block">
        <span>Short content.</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

describe("extractMetadata", () => {
  it("should extract author from og:title meta tag", () => {
    const { author } = extractMetadata(MOCK_ARTICLE_HTML, "https://x.com/johndoe/article/123");
    expect(author).toBe("John Doe");
  });

  it("should extract handle from link", () => {
    const { handle } = extractMetadata(MOCK_ARTICLE_HTML, "https://x.com/johndoe/article/123");
    expect(handle).toBe("@johndoe");
  });

  it("should extract publish date from time element", () => {
    const { publishDate } = extractMetadata(MOCK_ARTICLE_HTML, "https://x.com/johndoe/article/123");
    expect(publishDate).toBe("2026-01-15T10:30:00.000Z");
  });

  it("should return defaults when metadata is missing", () => {
    const { author, handle, publishDate } = extractMetadata(
      MOCK_ARTICLE_MINIMAL,
      "https://x.com/user/article/1",
    );
    expect(author).toBe("Unknown");
    expect(handle).toBe("@user");
    expect(publishDate).toBe("");
  });
});

describe("extractArticle", () => {
  it("should extract article with title, author, and body", () => {
    const result = extractArticle(
      MOCK_ARTICLE_HTML,
      "https://x.com/johndoe/article/123",
      "My Article",
    );
    expect(result.title).toBe("My Article");
    expect(result.author).toBe("John Doe");
    expect(result.handle).toBe("@johndoe");
    expect(result.sourceUrl).toBe("https://x.com/johndoe/article/123");
  });

  it("should calculate reading time", () => {
    const result = extractArticle(MOCK_ARTICLE_HTML, "https://x.com/johndoe/article/123", "Test");
    expect(result.readingTime).toBeGreaterThanOrEqual(1);
  });

  it("should have body HTML content", () => {
    const result = extractArticle(MOCK_ARTICLE_HTML, "https://x.com/johndoe/article/123", "Test");
    expect(result.bodyHtml.length).toBeGreaterThan(0);
  });

  it("should handle articles with lists", () => {
    const result = extractArticle(
      MOCK_ARTICLE_WITH_LISTS,
      "https://x.com/user/article/1",
      "List Article",
    );
    expect(result.bodyHtml).toContain("Item one");
  });

  it("should extract from minimal articles via fallback", () => {
    const result = extractArticle(MOCK_ARTICLE_MINIMAL, "https://x.com/user/article/1", "Minimal");
    expect(result.bodyHtml).toContain("Short content");
  });

  it("should include publish date in ISO 8601 format", () => {
    const result = extractArticle(MOCK_ARTICLE_HTML, "https://x.com/johndoe/article/123", "Test");
    expect(result.publishDate).toBe("2026-01-15T10:30:00.000Z");
  });
});
