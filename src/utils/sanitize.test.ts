import { describe, it, expect } from "vitest";
import { validateArticleUrl, sanitizeFilename, buildOutputFilename } from "./sanitize.js";

describe("validateArticleUrl", () => {
  it("should accept valid x.com URLs", () => {
    const url = validateArticleUrl("https://x.com/user/article/123");
    expect(url.hostname).toBe("x.com");
  });

  it("should accept valid twitter.com URLs", () => {
    const url = validateArticleUrl("https://twitter.com/user/article/123");
    expect(url.hostname).toBe("twitter.com");
  });

  it("should accept www.x.com URLs", () => {
    const url = validateArticleUrl("https://www.x.com/user/article/123");
    expect(url.hostname).toBe("www.x.com");
  });

  it("should throw UserError for invalid URLs", () => {
    expect(() => validateArticleUrl("not-a-url")).toThrow(
      "Invalid URL. Please provide an X Article URL.",
    );
  });

  it("should throw UserError for non-X URLs", () => {
    expect(() => validateArticleUrl("https://example.com/article")).toThrow(
      "Invalid URL. Please provide an X Article URL.",
    );
  });
});

describe("sanitizeFilename", () => {
  it("should convert to lowercase and replace spaces with hyphens", () => {
    expect(sanitizeFilename("My Article Title")).toBe("my-article-title");
  });

  it("should remove special characters", () => {
    expect(sanitizeFilename("Hello! World? #2026")).toBe("hello-world-2026");
  });

  it("should collapse multiple hyphens", () => {
    expect(sanitizeFilename("a---b")).toBe("a-b");
  });

  it("should truncate to 200 chars", () => {
    const long = "a".repeat(300);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });
});

describe("buildOutputFilename", () => {
  it("should build correct filename format", () => {
    const filename = buildOutputFilename(
      "My Article",
      "@johndoe",
      "https://x.com/johndoe/article/123",
      "2026-01-15T10:30:00.000Z",
    );
    expect(filename).toMatch(/^2026-01-15-my-article-johndoe-.+\.kepub\.epub$/);
  });

  it("should use current date when no date provided", () => {
    const filename = buildOutputFilename("Test", "@user", "https://x.com/user/1");
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-test-user-.+\.kepub\.epub$/);
  });
});
