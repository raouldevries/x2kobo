import { describe, it, expect } from "vitest";
import {
  extractArticle,
  extractMetadata,
  extractGenericMetadata,
  extractGenericArticle,
  validateExtractedContent,
} from "./metadata.js";

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

const MOCK_GENERIC_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>A Great Blog Post</title>
  <meta property="og:title" content="A Great Blog Post - My Blog" />
  <meta name="author" content="Jane Smith" />
  <meta property="article:published_time" content="2026-02-20T12:00:00Z" />
</head>
<body>
  <article>
    <h1>A Great Blog Post</h1>
    <p>This is a substantial blog post with enough content to be extracted by Readability.
    It contains multiple paragraphs and covers an interesting topic that readers would
    enjoy on their Kobo e-reader. The content is well-structured and informative.</p>
    <p>Second paragraph with more detail about the topic. This ensures we have enough
    content for Readability to consider it a valid article extraction.</p>
    <p>Third paragraph concluding the article with final thoughts and a summary of
    the key points discussed throughout the post.</p>
  </article>
</body>
</html>
`;

const MOCK_GENERIC_MINIMAL = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <h1>Minimal Page</h1>
  <p>Short.</p>
</body>
</html>
`;

const MOCK_GENERIC_OG_SITE = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Tech Article" />
  <meta property="og:site_name" content="TechBlog" />
  <time datetime="2026-03-01T08:00:00Z">March 1</time>
</head>
<body>
  <article>
    <p>Some content here.</p>
  </article>
</body>
</html>
`;

describe("extractGenericMetadata", () => {
  it("should extract title from og:title", () => {
    const { title } = extractGenericMetadata(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
    );
    expect(title).toBe("A Great Blog Post - My Blog");
  });

  it("should extract author from meta author", () => {
    const { author } = extractGenericMetadata(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
    );
    expect(author).toBe("Jane Smith");
  });

  it("should extract publish date from article:published_time", () => {
    const { publishDate } = extractGenericMetadata(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
    );
    expect(publishDate).toBe("2026-02-20T12:00:00Z");
  });

  it("should return empty handle", () => {
    const { handle } = extractGenericMetadata(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
    );
    expect(handle).toBe("");
  });

  it("should fall back to h1 for title when no meta tags", () => {
    const { title } = extractGenericMetadata(MOCK_GENERIC_MINIMAL, "https://example.com/page");
    expect(title).toBe("Minimal Page");
  });

  it("should fall back to og:site_name for author", () => {
    const { author } = extractGenericMetadata(MOCK_GENERIC_OG_SITE, "https://techblog.com/article");
    expect(author).toBe("TechBlog");
  });

  it("should fall back to time element for date", () => {
    const { publishDate } = extractGenericMetadata(
      MOCK_GENERIC_OG_SITE,
      "https://techblog.com/article",
    );
    expect(publishDate).toBe("2026-03-01T08:00:00Z");
  });

  it("should use hostname when no author metadata found", () => {
    const { author } = extractGenericMetadata(MOCK_GENERIC_MINIMAL, "https://example.com/page");
    expect(author).toBe("example.com");
  });
});

describe("extractGenericArticle", () => {
  it("should extract article with title, author, and body", () => {
    const result = extractGenericArticle(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
      "Fallback Title",
    );
    expect(result.title).toBe("A Great Blog Post - My Blog");
    expect(result.author).toBe("Jane Smith");
    expect(result.handle).toBe("");
    expect(result.sourceUrl).toBe("https://example.com/blog/great-post");
  });

  it("should calculate reading time", () => {
    const result = extractGenericArticle(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
      "Test",
    );
    expect(result.readingTime).toBeGreaterThanOrEqual(1);
  });

  it("should have body HTML content", () => {
    const result = extractGenericArticle(
      MOCK_GENERIC_HTML,
      "https://example.com/blog/great-post",
      "Test",
    );
    expect(result.bodyHtml.length).toBeGreaterThan(0);
    expect(result.bodyHtml).toContain("substantial blog post");
  });

  it("should fall back to body innerHTML for minimal pages", () => {
    const result = extractGenericArticle(MOCK_GENERIC_MINIMAL, "https://example.com/page", "Min");
    expect(result.bodyHtml).toContain("Short.");
  });

  it("should use pageTitle as fallback title", () => {
    const html = "<html><head></head><body><p>Content</p></body></html>";
    const result = extractGenericArticle(html, "https://example.com/", "Page Title Fallback");
    expect(result.title).toBeTruthy();
  });
});

// These fixtures use very short content so Readability returns <100 chars,
// forcing the fallback path to trigger.
const MOCK_FALLBACK_ARTICLE_TAG = `
<!DOCTYPE html>
<html>
<head><title>Fallback Test</title></head>
<body>
  <nav>Navigation links</nav>
  <article><p>Article content preferred</p></article>
  <footer>Footer stuff</footer>
</body>
</html>
`;

const MOCK_FALLBACK_MAIN_TAG =
  "<html><body><nav>N</nav><main><p>Main preferred</p></main></body></html>";

const MOCK_FALLBACK_BODY_ONLY = `
<!DOCTYPE html>
<html>
<head><title>Body Test</title></head>
<body>
  <div><p>Body only content here</p></div>
</body>
</html>
`;

describe("extractGenericArticle fallback chain", () => {
  it("should prefer <article> over full body when Readability fails", () => {
    const result = extractGenericArticle(
      MOCK_FALLBACK_ARTICLE_TAG,
      "https://example.com/page",
      "Test",
    );
    expect(result.bodyHtml).toContain("Article content preferred");
    expect(result.bodyHtml).not.toContain("Navigation links");
    expect(result.bodyHtml).not.toContain("Footer stuff");
  });

  it("should prefer <main> over full body when no <article> exists", () => {
    const result = extractGenericArticle(
      MOCK_FALLBACK_MAIN_TAG,
      "https://example.com/page",
      "Test",
    );
    expect(result.bodyHtml).toContain("Main preferred");
    // Fallback used <main> innerHTML, not full body
    expect(result.bodyHtml).not.toContain("<nav>");
    expect(result.bodyHtml).not.toContain("<footer>");
  });

  it("should fall back to body when no <article> or <main> exists", () => {
    const result = extractGenericArticle(
      MOCK_FALLBACK_BODY_ONLY,
      "https://example.com/page",
      "Test",
    );
    expect(result.bodyHtml).toContain("Body only content here");
  });
});

describe("Draft.js preprocessing", () => {
  const MOCK_DRAFTJS_HTML = `
<!DOCTYPE html>
<html>
<head><title>Draft Test</title></head>
<body>
  <article>
    <div class="public-DraftStyleDefault-block" data-offset-key="abc">
      <span data-offset-key="abc-0">First paragraph of content that is long enough for extraction purposes and validation checks.</span>
    </div>
    <div class="public-DraftStyleDefault-block" data-offset-key="def">
      <span data-offset-key="def-0">Second paragraph of content that adds more words to pass the minimum word count threshold easily.</span>
    </div>
    <div class="public-DraftStyleDefault-block" data-offset-key="ghi">
      <span data-offset-key="ghi-0">Third paragraph with additional content to make sure this is extracted as valid article content by Readability.</span>
    </div>
  </article>
</body>
</html>
`;

  it("should skip Draft.js preprocessing for generic URLs", () => {
    const result = extractGenericArticle(
      MOCK_DRAFTJS_HTML,
      "https://example.com/article",
      "Draft Test",
    );
    // Draft.js data-offset-key attributes should be preserved (not stripped) for generic URLs
    expect(result.bodyHtml).toContain("data-offset-key");
  });

  it("should apply Draft.js preprocessing for X URLs", () => {
    // Use same Draft.js fixture to test the extractWithReadability primary path
    const result = extractArticle(
      MOCK_DRAFTJS_HTML,
      "https://x.com/johndoe/article/123",
      "Draft Test",
    );
    // preprocessDraftJs strips data-offset-key attributes; if skipped they'd remain
    expect(result.bodyHtml).not.toContain("data-offset-key");
    expect(result.bodyHtml).not.toContain("public-DraftStyleDefault-block");
  });
});

describe("validateExtractedContent", () => {
  const validArticle = {
    title: "A Normal Article",
    author: "Author",
    handle: "",
    publishDate: "",
    bodyHtml:
      "<p>" + "word ".repeat(50) + "</p>",
    sourceUrl: "https://example.com/article",
    readingTime: 1,
  };

  it("should pass for valid content", () => {
    expect(() => validateExtractedContent(validArticle)).not.toThrow();
  });

  it("should throw for empty body", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, bodyHtml: "" }),
    ).toThrow("No article content could be extracted");
  });

  it("should throw for body with too few words", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, bodyHtml: "<p>Short text only.</p>" }),
    ).toThrow("No article content could be extracted");
  });

  it("should throw for rate limit error page title", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Too many requests · GitHub" }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should throw for access denied title", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Access Denied" }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should throw for 404 not found title", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "404 Not Found" }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should throw for captcha/challenge title", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Just a moment..." }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should throw for forbidden title", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "403 Forbidden" }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should not false-positive on articles about errors", () => {
    expect(() =>
      validateExtractedContent({
        ...validArticle,
        title: "How to Handle Rate Limiting in Your API",
      }),
    ).not.toThrow();
  });

  it("should not false-positive on articles mentioning 'not found'", () => {
    expect(() =>
      validateExtractedContent({
        ...validArticle,
        title: "The Lost City: Not Found for 100 Years",
      }),
    ).not.toThrow();
  });

  it("should not false-positive on '100 Days of Code'", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "100 Days of Code: A Retrospective" }),
    ).not.toThrow();
  });

  it("should not false-positive on 'Rate Limiting Your API'", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Rate Limiting Your API" }),
    ).not.toThrow();
  });

  it("should not false-positive on 'Blocked: My Story'", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Blocked: My Story" }),
    ).not.toThrow();
  });

  it("should still catch '429 Too Many Requests'", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "429 Too Many Requests" }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should not false-positive on 'Too Many Requests: Rate Limiting Explained'", () => {
    expect(() =>
      validateExtractedContent({
        ...validArticle,
        title: "Too Many Requests: Rate Limiting Explained",
      }),
    ).not.toThrow();
  });

  it("should not false-positive on 'Just a Moment in Time'", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Just a Moment in Time" }),
    ).not.toThrow();
  });

  it("should catch Cloudflare 'Just a moment...'", () => {
    expect(() =>
      validateExtractedContent({ ...validArticle, title: "Just a moment..." }),
    ).toThrow("The page returned an error instead of article content");
  });

  it("should not false-positive on '101 Essays That Will Change...'", () => {
    expect(() =>
      validateExtractedContent({
        ...validArticle,
        title: "101 Essays That Will Change The Way You Think",
      }),
    ).not.toThrow();
  });

  it("should pass for CJK text with enough characters", () => {
    const cjkBody =
      "<p>これは日本語の記事です。十分な長さがありますがスペースはほとんどありません。記事の内容は素晴らしいです。もっと読みたいと思います。日本語のテキストです。この記事は非常に興味深い内容を含んでいます。読者の皆様にお楽しみいただけると幸いです。</p>";
    expect(() =>
      validateExtractedContent({ ...validArticle, bodyHtml: cjkBody }),
    ).not.toThrow();
  });

  it("should reject very short CJK text", () => {
    const shortCjk = "<p>短い</p>";
    expect(() =>
      validateExtractedContent({ ...validArticle, bodyHtml: shortCjk }),
    ).toThrow("No article content could be extracted");
  });
});
