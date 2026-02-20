import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("playwright", () => {
  const mockContext = {
    close: vi.fn(),
  };
  return {
    chromium: {
      launchPersistentContext: vi.fn().mockResolvedValue(mockContext),
    },
  };
});

describe("browser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should return a browser context with default headless option", async () => {
    const { getBrowser } = await import("./browser.js");
    const { chromium } = await import("playwright");
    const ctx = await getBrowser();
    expect(ctx).toBeDefined();
    expect(chromium.launchPersistentContext).toHaveBeenCalledWith(
      expect.stringContaining(".x2kobo/browser-data"),
      { headless: true, channel: "chrome" },
    );
  });

  it("should pass headless false when specified", async () => {
    const { getBrowser } = await import("./browser.js");
    const { chromium } = await import("playwright");
    await getBrowser({ headless: false });
    expect(chromium.launchPersistentContext).toHaveBeenCalledWith(
      expect.stringContaining(".x2kobo/browser-data"),
      { headless: false, channel: "chrome" },
    );
  });

  it("should reuse existing context on second call", async () => {
    const { getBrowser } = await import("./browser.js");
    const { chromium } = await import("playwright");
    const ctx1 = await getBrowser();
    const ctx2 = await getBrowser();
    expect(ctx1).toBe(ctx2);
    expect(chromium.launchPersistentContext).toHaveBeenCalledTimes(1);
  });

  it("should close the browser context", async () => {
    const { getBrowser, closeBrowser } = await import("./browser.js");
    const ctx = await getBrowser();
    await closeBrowser();
    expect(ctx.close).toHaveBeenCalled();
  });

  it("should handle closeBrowser when no context exists", async () => {
    const { closeBrowser } = await import("./browser.js");
    await expect(closeBrowser()).resolves.toBeUndefined();
  });

  it("should throw UserError when Chromium is not installed", async () => {
    const { chromium } = await import("playwright");
    vi.mocked(chromium.launchPersistentContext).mockRejectedValueOnce(
      new Error("Executable doesn't exist at /path/to/chromium"),
    );
    const { getBrowser } = await import("./browser.js");
    try {
      await getBrowser();
      expect.unreachable("should have thrown");
    } catch (error: unknown) {
      expect((error as { isUserError?: boolean }).isUserError).toBe(true);
      expect((error as Error).message).toBe(
        "Browser not found. Run `npx playwright install chromium` to install.",
      );
    }
  });

  it("should re-throw non-Chromium errors", async () => {
    const { chromium } = await import("playwright");
    vi.mocked(chromium.launchPersistentContext).mockRejectedValueOnce(
      new Error("Some other error"),
    );
    const { getBrowser } = await import("./browser.js");
    await expect(getBrowser()).rejects.toThrow("Some other error");
  });
});
