import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  goto: vi.fn(),
  url: vi.fn().mockReturnValue("https://x.com/user/article/123"),
  $: vi.fn().mockResolvedValue(null),
  $$eval: vi.fn().mockResolvedValue(false),
  waitForSelector: vi.fn(),
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
    await expect(loadArticle("https://example.com/foo")).rejects.toThrow(
      "Invalid URL. Please provide an X Article URL.",
    );
  });

  it("should return page when article is detected via primary selector", async () => {
    mockPage.waitForSelector.mockResolvedValueOnce(true);
    const { loadArticle } = await import("./article.js");
    const page = await loadArticle("https://x.com/user/article/123");
    expect(page).toBe(mockPage);
  });

  it("should detect login wall via URL redirect", async () => {
    mockPage.url.mockReturnValue("https://x.com/i/flow/login");
    mockPage.waitForSelector.mockRejectedValue(new Error("timeout"));
    const { loadArticle } = await import("./article.js");
    await expect(loadArticle("https://x.com/user/article/123")).rejects.toThrow(
      "Run `npx x2kobo login` to log in again.",
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
      "Run `npx x2kobo login` to log in again.",
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
});
