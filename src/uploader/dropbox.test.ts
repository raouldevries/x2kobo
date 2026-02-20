import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTokens = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 3600_000,
  appKey: "test-app-key",
};

vi.mock("../config/store.js", () => ({
  getDropboxTokens: vi.fn(() => mockTokens),
  saveDropboxTokens: vi.fn(),
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn(() => Buffer.from("test file content")),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

describe("uploadToDropbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
        }),
      ),
    );
  });

  it("should upload file to correct Dropbox path", async () => {
    const { uploadToDropbox } = await import("./dropbox.js");
    await uploadToDropbox("/tmp/test.kepub.epub", "test.kepub.epub");

    expect(fetch).toHaveBeenCalledWith(
      "https://content.dropboxapi.com/2/files/upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
  });

  it("should include correct Dropbox-API-Arg header", async () => {
    const { uploadToDropbox } = await import("./dropbox.js");
    await uploadToDropbox("/tmp/test.kepub.epub", "test.kepub.epub");

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = (callArgs[1] as { headers: Record<string, string> }).headers;
    const apiArg = JSON.parse(headers["Dropbox-API-Arg"]);
    expect(apiArg.path).toBe("/Rakuten Kobo/test.kepub.epub");
    expect(apiArg.autorename).toBe(true);
  });

  it("should throw UserError when no tokens configured", async () => {
    const { getDropboxTokens } = await import("../config/store.js");
    vi.mocked(getDropboxTokens).mockReturnValueOnce(undefined);

    const { uploadToDropbox } = await import("./dropbox.js");
    await expect(uploadToDropbox("/tmp/test.kepub.epub", "test.kepub.epub")).rejects.toThrow(
      "Run `npx x2kobo auth` to set up",
    );
  });

  it("should throw UserError on quota full", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          text: () => Promise.resolve('{"error": {"insufficient_space": {}}}'),
        }),
      ),
    );

    const { uploadToDropbox } = await import("./dropbox.js");
    await expect(uploadToDropbox("/tmp/test.kepub.epub", "test.kepub.epub")).rejects.toThrow(
      "Dropbox quota is full",
    );
  });

  it("should throw UserError on invalid token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve("unauthorized"),
        }),
      ),
    );

    const { uploadToDropbox } = await import("./dropbox.js");
    await expect(uploadToDropbox("/tmp/test.kepub.epub", "test.kepub.epub")).rejects.toThrow(
      "Dropbox token is invalid",
    );
  });
});
