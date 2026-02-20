import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  goto: vi.fn(),
  waitForLoadState: vi.fn(),
  evaluate: vi.fn(),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
};

vi.mock("../extractor/browser.js", () => ({
  getBrowser: vi.fn().mockResolvedValue(mockContext),
  closeBrowser: vi.fn(),
}));

vi.mock("readline", () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn((_prompt: string, cb: () => void) => cb()),
    close: vi.fn(),
  }),
}));

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should open browser to x.com/login", async () => {
    mockPage.evaluate.mockResolvedValue(true);
    const { login } = await import("./login.js");
    await login();
    expect(mockPage.goto).toHaveBeenCalledWith("https://x.com/login");
  });

  it("should verify login by navigating to home", async () => {
    mockPage.evaluate.mockResolvedValue(true);
    const { login } = await import("./login.js");
    await login();
    expect(mockPage.goto).toHaveBeenCalledWith("https://x.com/home");
    expect(mockPage.waitForLoadState).toHaveBeenCalledWith("networkidle");
  });

  it("should throw UserError when login verification fails", async () => {
    mockPage.evaluate.mockResolvedValue(false);
    const { login } = await import("./login.js");
    try {
      await login();
      expect.unreachable("should have thrown");
    } catch (error: unknown) {
      expect((error as { isUserError?: boolean }).isUserError).toBe(true);
      expect((error as Error).message).toContain("Login could not be verified");
    }
  });

  it("should close browser after successful login", async () => {
    mockPage.evaluate.mockResolvedValue(true);
    const { login } = await import("./login.js");
    const { closeBrowser } = await import("../extractor/browser.js");
    await login();
    expect(closeBrowser).toHaveBeenCalled();
  });
});
