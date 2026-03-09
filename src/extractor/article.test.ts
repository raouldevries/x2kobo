import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  goto: vi.fn(),
  url: vi.fn().mockReturnValue("https://x.com/user/article/123"),
  $: vi.fn().mockResolvedValue(null),
  $$eval: vi.fn().mockResolvedValue(false),
  waitForSelector: vi.fn(),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
  content: vi.fn().mockResolvedValue("<html></html>"),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
};

vi.mock("./browser.js", () => ({
  getBrowser: vi.fn().mockResolvedValue(mockContext),
}));

vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("loadArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage.url.mockReturnValue("https://x.com/user/article/123");
    mockPage.$.mockResolvedValue(null);
    mockPage.$$eval.mockResolvedValue(false);
    mockPage.goto.mockResolvedValue(undefined);
  });

  it("should reject invalid URLs", async () => {
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("ftp://example.com/foo")).rejects.toThrow(
      "Invalid URL. Please provide a valid HTTP or HTTPS URL.",
    );
  });

  it("should return page when article is detected via primary selector", async () => {
    mockPage.waitForSelector
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    const page = await loadArticle("https://x.com/user/article/123");
    expect(page).toBe(mockPage);
  });

  it("should detect login wall via URL redirect", async () => {
    mockPage.url.mockReturnValue("https://x.com/i/flow/login");
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://x.com/user/article/123")).rejects.toThrow(
      "X requires login to view this article.",
    );
  });

  it("should detect login wall via login form selector", async () => {
    mockPage.$.mockImplementation(async (selector: string) => {
      if (selector === '[data-testid="loginForm"]') return {};
      return null;
    });
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://x.com/user/article/123")).rejects.toThrow(
      "X requires login to view this article.",
    );
  });

  it("should detect regular tweet", async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    mockPage.$.mockImplementation(async (selector: string) => {
      if (selector === '[data-testid="tweetText"]') return {};
      return null;
    });
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://x.com/user/status/123")).rejects.toThrow(
      "This appears to be a regular tweet, not an X Article.",
    );
  });

  it("should throw timeout error when no content detected", async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://x.com/user/article/123")).rejects.toThrow(
      "Could not detect article content within 30 seconds.",
    );
  });

  it("should save debug snapshot on failure", async () => {
    const { writeFileSync, mkdirSync } = await import("fs");
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    try {
      await loadArticle("https://x.com/user/article/123");
    } catch {
      // expected
    }
    expect(mkdirSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("should handle page navigation timeout", async () => {
    mockPage.goto.mockRejectedValueOnce(new Error("Navigation timeout"));
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://x.com/user/article/123")).rejects.toThrow(
      "Page loading timed out after 30 seconds.",
    );
  });

  it("should use waitForLoadState networkidle for generic URLs", async () => {
    mockPage.url.mockReturnValue("https://example.com/article");
    const { loadArticle } = await import("./article.js");
    const page = await loadArticle("https://example.com/article");
    expect(page).toBe(mockPage);
    expect(mockPage.waitForLoadState).toHaveBeenCalledWith("networkidle", { timeout: 10_000 });
    // Should NOT have called waitForSelector (X article detection)
    expect(mockPage.waitForSelector).not.toHaveBeenCalled();
    // Should NOT have called waitForTimeout (old approach)
    expect(mockPage.waitForTimeout).not.toHaveBeenCalled();
  });

  it("should return page even if networkidle times out for generic URLs", async () => {
    mockPage.url.mockReturnValue("https://example.com/article");
    const timeoutError = new Error("Timeout 10000ms exceeded");
    timeoutError.name = "TimeoutError";
    mockPage.waitForLoadState.mockRejectedValueOnce(timeoutError);
    const { loadArticle } = await import("./article.js");
    const page = await loadArticle("https://example.com/article");
    expect(page).toBe(mockPage);
    // Should still return the page despite timeout
    expect(mockPage.waitForLoadState).toHaveBeenCalled();
  });

  it("should rethrow non-timeout errors from waitForLoadState for generic URLs", async () => {
    mockPage.url.mockReturnValue("https://example.com/article");
    mockPage.waitForLoadState.mockRejectedValueOnce(
      new Error("Target page, context or browser has been closed"),
    );
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://example.com/article")).rejects.toThrow(
      "Target page, context or browser has been closed",
    );
  });

  it("should not use waitForLoadState for X URLs", async () => {
    mockPage.waitForSelector
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    await loadArticle("https://x.com/user/article/123");
    expect(mockPage.waitForLoadState).not.toHaveBeenCalled();
  });

  it("should handle navigation timeout for generic URLs", async () => {
    mockPage.goto.mockRejectedValueOnce(new Error("Navigation timeout"));
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://example.com/article")).rejects.toThrow(
      "Page loading timed out after 30 seconds.",
    );
  });
});
