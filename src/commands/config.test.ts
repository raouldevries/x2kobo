import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/store.js", () => ({
  getUserDefaults: vi.fn().mockReturnValue({}),
  saveUserDefaults: vi.fn(),
  VALID_DEFAULT_KEYS: ["noUpload", "useChrome", "verbose", "debug", "output"],
}));

describe("config commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("configSet", () => {
    it("should set a boolean config value", async () => {
      const { configSet } = await import("./config.js");
      const { saveUserDefaults } = await import("../config/store.js");

      configSet("noUpload", "true");

      expect(saveUserDefaults).toHaveBeenCalledWith(
        expect.objectContaining({ noUpload: true }),
      );
      expect(console.log).toHaveBeenCalledWith("Set noUpload = true");
    });

    it("should set a string config value for output", async () => {
      const { configSet } = await import("./config.js");
      const { saveUserDefaults } = await import("../config/store.js");

      configSet("output", "/tmp/articles");

      expect(saveUserDefaults).toHaveBeenCalledWith(
        expect.objectContaining({ output: "/tmp/articles" }),
      );
    });

    it("should throw on invalid key", async () => {
      const { configSet } = await import("./config.js");
      expect(() => configSet("badKey", "true")).toThrow('Unknown config key "badKey"');
    });

    it("should throw on invalid boolean value", async () => {
      const { configSet } = await import("./config.js");
      expect(() => configSet("noUpload", "yes")).toThrow('Invalid value "yes"');
    });
  });

  describe("configGet", () => {
    it("should show value when set", async () => {
      const { getUserDefaults } = await import("../config/store.js");
      vi.mocked(getUserDefaults).mockReturnValue({ noUpload: true });

      const { configGet } = await import("./config.js");
      configGet("noUpload");

      expect(console.log).toHaveBeenCalledWith("noUpload: true");
    });

    it("should show (not set) when unset", async () => {
      const { configGet } = await import("./config.js");
      configGet("verbose");

      expect(console.log).toHaveBeenCalledWith("verbose: (not set)");
    });

    it("should throw on invalid key", async () => {
      const { configGet } = await import("./config.js");
      expect(() => configGet("badKey")).toThrow('Unknown config key "badKey"');
    });
  });

  describe("configList", () => {
    it("should list all set defaults", async () => {
      const { getUserDefaults } = await import("../config/store.js");
      vi.mocked(getUserDefaults).mockReturnValue({ noUpload: true, verbose: false });

      const { configList } = await import("./config.js");
      configList();

      expect(console.log).toHaveBeenCalledWith("noUpload: true");
      expect(console.log).toHaveBeenCalledWith("verbose: false");
    });

    it("should show message when no defaults configured", async () => {
      const { getUserDefaults } = await import("../config/store.js");
      vi.mocked(getUserDefaults).mockReturnValue({});

      const { configList } = await import("./config.js");
      configList();

      expect(console.log).toHaveBeenCalledWith("No defaults configured.");
    });
  });

  describe("configReset", () => {
    it("should clear all defaults", async () => {
      const { configReset } = await import("./config.js");
      const { saveUserDefaults } = await import("../config/store.js");

      configReset();

      expect(saveUserDefaults).toHaveBeenCalledWith({});
      expect(console.log).toHaveBeenCalledWith("All defaults cleared.");
    });
  });
});
