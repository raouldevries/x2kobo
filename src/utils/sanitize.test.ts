import { describe, it, expect } from "vitest";
import { validateUrl, isXUrl, sanitizeFilename, buildOutputFilename } from "./sanitize.js";

describe("validateUrl", () => {
  it("should accept valid x.com URLs", () => {
    const url = validateUrl("https://x.com/user/article/123");
    expect(url.hostname).toBe("x.com");
  });

  it("should accept valid twitter.com URLs", () => {
    const url = validateUrl("https://twitter.com/user/article/123");
    expect(url.hostname).toBe("twitter.com");
  });

  it("should accept any valid HTTPS URL", () => {
    const url = validateUrl("https://example.com/article");
    expect(url.hostname).toBe("example.com");
  });

  it("should accept HTTP URLs", () => {
    const url = validateUrl("http://example.com/page");
    expect(url.protocol).toBe("http:");
  });

  it("should throw UserError for invalid URLs", () => {
    expect(() => validateUrl("not-a-url")).toThrow(
      "Invalid URL. Please provide a valid HTTP or HTTPS URL.",
    );
  });

  it("should throw UserError for non-HTTP protocols", () => {
    expect(() => validateUrl("ftp://example.com/file")).toThrow(
      "Invalid URL. Please provide a valid HTTP or HTTPS URL.",
    );
  });
});

describe("isXUrl", () => {
  it("should return true for x.com", () => {
    expect(isXUrl("https://x.com/user/article/123")).toBe(true);
  });

  it("should return true for twitter.com", () => {
    expect(isXUrl("https://twitter.com/user/article/123")).toBe(true);
  });

  it("should return true for www.x.com", () => {
    expect(isXUrl("https://www.x.com/user/article/123")).toBe(true);
  });

  it("should return false for other domains", () => {
    expect(isXUrl("https://example.com/article")).toBe(false);
  });

  it("should return false for invalid URLs", () => {
    expect(isXUrl("not-a-url")).toBe(false);
  });

  it("should accept URL objects", () => {
    expect(isXUrl(new URL("https://x.com/user"))).toBe(true);
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
  it("should build correct filename format with handle", () => {
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

  it("should omit handle from filename when handle is empty", () => {
    const filename = buildOutputFilename(
      "Generic Article",
      "",
      "https://example.com/article",
      "2026-03-01T00:00:00Z",
    );
    expect(filename).toMatch(/^2026-03-01-generic-article-.+\.kepub\.epub$/);
    expect(filename).not.toContain("--");
  });
});
