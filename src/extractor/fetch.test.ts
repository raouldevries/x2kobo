import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchArticle } from "./fetch.js";

const MINIMAL_HTML = `<!DOCTYPE html><html><head><title>Test Page</title></head><body>${"<p>Content paragraph with enough text to pass the minimum length check.</p>".repeat(10)}</body></html>`;

describe("fetchArticle", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return html, url, and title from a successful fetch", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/article",
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: async () => MINIMAL_HTML,
    });

    const result = await fetchArticle("https://example.com/article");
    expect(result.html).toContain("Content paragraph");
    expect(result.url).toBe("https://example.com/article");
    expect(result.title).toBe("Test Page");
  });

  it("should use final URL after redirects", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/final-page",
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => MINIMAL_HTML,
    });

    const result = await fetchArticle("https://example.com/redirect");
    expect(result.url).toBe("https://example.com/final-page");
  });

  it("should throw on non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      url: "https://example.com/forbidden",
      headers: new Headers({ "content-type": "text/html" }),
    });

    await expect(fetchArticle("https://example.com/forbidden")).rejects.toThrow("HTTP 403");
  });

  it("should throw on non-HTML content type", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/file.pdf",
      headers: new Headers({ "content-type": "application/pdf" }),
      text: async () => "PDF content",
    });

    await expect(fetchArticle("https://example.com/file.pdf")).rejects.toThrow("Non-HTML");
  });

  it("should throw on response shorter than minimum length", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/spa",
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => '<html><body><div id="root"></div></body></html>',
    });

    await expect(fetchArticle("https://example.com/spa")).rejects.toThrow("too short");
  });

  it("should return empty title when page has no title tag", async () => {
    const noTitleHtml = `<!DOCTYPE html><html><head></head><body>${"<p>Enough content here to pass the length check.</p>".repeat(15)}</body></html>`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/no-title",
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => noTitleHtml,
    });

    const result = await fetchArticle("https://example.com/no-title");
    expect(result.title).toBe("");
  });

  it("should accept application/xhtml+xml content type", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/xhtml",
      headers: new Headers({ "content-type": "application/xhtml+xml" }),
      text: async () => MINIMAL_HTML,
    });

    const result = await fetchArticle("https://example.com/xhtml");
    expect(result.html).toContain("Content paragraph");
  });
});
