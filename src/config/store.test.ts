import { describe, it, expect, vi, beforeEach } from "vitest";
import { paths } from "./store.js";
import { homedir } from "os";
import { join } from "path";

describe("paths", () => {
  it("should have configDir under home directory", () => {
    expect(paths.configDir).toBe(join(homedir(), ".x2kobo"));
  });

  it("should have browserData under configDir", () => {
    expect(paths.browserData).toBe(join(homedir(), ".x2kobo", "browser-data"));
  });
});

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
}));

describe("getUserDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should return empty object when no config exists", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { getUserDefaults } = await import("./store.js");
    expect(getUserDefaults()).toEqual({});
  });

  it("should return empty object when config has no defaults", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ dropbox: { accessToken: "tok" } }));
    const { getUserDefaults } = await import("./store.js");
    expect(getUserDefaults()).toEqual({});
  });

  it("should return saved defaults", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ defaults: { noUpload: true, verbose: false } }),
    );
    const { getUserDefaults } = await import("./store.js");
    expect(getUserDefaults()).toEqual({ noUpload: true, verbose: false });
  });
});

describe("saveUserDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should persist defaults without clobbering dropbox tokens", async () => {
    const fs = await import("fs");
    const existingConfig = { dropbox: { accessToken: "tok", refreshToken: "ref", expiresAt: 123, appKey: "k", appSecret: "s" } };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));

    const { saveUserDefaults } = await import("./store.js");
    saveUserDefaults({ noUpload: true });

    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.dropbox.accessToken).toBe("tok");
    expect(parsed.defaults.noUpload).toBe(true);
  });
});
