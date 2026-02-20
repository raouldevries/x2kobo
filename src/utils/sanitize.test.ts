import { describe, it, expect } from "vitest";
import { validateArticleUrl } from "./sanitize.js";

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
