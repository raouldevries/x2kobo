import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("../config/store.js", () => ({
  paths: {
    configDir: "/home/user/.x2kobo",
    browserData: "/home/user/.x2kobo/browser-data",
    configFile: "/home/user/.x2kobo/config.json",
  },
  getDropboxTokens: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

describe("status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show status without errors when not configured", async () => {
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDropboxTokens } = await import("../config/store.js");
    vi.mocked(getDropboxTokens).mockReturnValue(undefined);

    const { status } = await import("./status.js");
    await expect(status()).resolves.toBeUndefined();
  });

  it("should show status when configured", async () => {
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);

    const { getDropboxTokens } = await import("../config/store.js");
    vi.mocked(getDropboxTokens).mockReturnValue({
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: Date.now() + 3600_000,
      appKey: "key",
    });

    const { status } = await import("./status.js");
    await expect(status()).resolves.toBeUndefined();
  });
});
