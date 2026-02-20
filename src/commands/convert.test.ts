import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  content: vi.fn().mockResolvedValue("<html><body><p>Test</p></body></html>"),
  title: vi.fn().mockResolvedValue("Test Article"),
  context: vi.fn().mockReturnValue({ request: { get: vi.fn() } }),
};

vi.mock("../extractor/article.js", () => ({
  loadArticle: vi.fn().mockResolvedValue(mockPage),
}));

vi.mock("../extractor/metadata.js", () => ({
  extractArticle: vi.fn().mockReturnValue({
    title: "Test Article",
    author: "Author",
    handle: "@author",
    publishDate: "2026-01-15T10:00:00Z",
    bodyHtml: "<p>Body content</p>",
    sourceUrl: "https://x.com/author/article/1",
    readingTime: 3,
  }),
}));

vi.mock("../utils/images.js", () => ({
  downloadImages: vi.fn().mockResolvedValue({
    html: "<p>Body content</p>",
    images: [],
    totalFound: 0,
    totalDownloaded: 0,
  }),
}));

vi.mock("../generator/epub.js", () => ({
  buildEpub: vi.fn().mockResolvedValue({
    data: Buffer.from("fake epub data"),
    filename: "2026-01-15-test-article-author-abc123.kepub.epub",
  }),
}));

vi.mock("../generator/kepub.js", () => ({
  transformToKepub: vi.fn().mockReturnValue("<html>kepub content</html>"),
}));

const mockZipFile = {
  async: vi.fn().mockResolvedValue("<html>chapter</html>"),
};
const mockZipInstance = {
  file: vi.fn().mockReturnValue(mockZipFile),
  generateAsync: vi.fn().mockResolvedValue(Buffer.from("final epub")),
};
vi.mock("jszip", () => ({
  default: {
    loadAsync: vi.fn().mockResolvedValue(mockZipInstance),
  },
}));

vi.mock("../uploader/dropbox.js", () => ({
  uploadToDropbox: vi.fn(),
}));

vi.mock("../extractor/browser.js", () => ({
  closeBrowser: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  startSpinner: vi.fn(),
  updateSpinner: vi.fn(),
  succeedSpinner: vi.fn(),
  failSpinner: vi.fn(),
  stopSpinner: vi.fn(),
  printSummary: vi.fn(),
}));

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  existsSync: vi.fn(),
}));

describe("convert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run the full pipeline", async () => {
    const { convert } = await import("./convert.js");
    await convert("https://x.com/author/article/1", { noUpload: true });

    const { loadArticle } = await import("../extractor/article.js");
    const { extractArticle } = await import("../extractor/metadata.js");

    expect(loadArticle).toHaveBeenCalledWith("https://x.com/author/article/1", { useSystemChrome: undefined, headless: true });
    expect(extractArticle).toHaveBeenCalled();
  });

  it("should skip upload when noUpload is true", async () => {
    const { convert } = await import("./convert.js");
    await convert("https://x.com/author/article/1", { noUpload: true });

    const { uploadToDropbox } = await import("../uploader/dropbox.js");
    expect(uploadToDropbox).not.toHaveBeenCalled();
  });

  it("should save file locally", async () => {
    const { convert } = await import("./convert.js");
    await convert("https://x.com/author/article/1", { noUpload: true });

    const { writeFileSync } = await import("fs");
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("should print summary after conversion", async () => {
    const { convert } = await import("./convert.js");
    await convert("https://x.com/author/article/1", { noUpload: true });

    const { printSummary } = await import("../utils/logger.js");
    expect(printSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Article",
      }),
    );
  });
});
