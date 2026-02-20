import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildEpub } from "./epub.js";
import type { ArticleData } from "../extractor/metadata.js";
import type { ImageAsset } from "../utils/images.js";

const MOCK_ARTICLE: ArticleData = {
  title: "Test Article",
  author: "John Doe",
  handle: "@johndoe",
  publishDate: "2026-01-15T10:30:00.000Z",
  bodyHtml: "<p>This is test content with enough words to matter.</p>",
  sourceUrl: "https://x.com/johndoe/article/123",
  readingTime: 5,
};

const MOCK_IMAGES: ImageAsset[] = [
  {
    filename: "img-001.jpg",
    data: Buffer.from([0xff, 0xd8, 0xff]),
    mediaType: "image/jpeg",
  },
];

describe("buildEpub", () => {
  it("should generate a valid ZIP with required files", async () => {
    const result = await buildEpub(MOCK_ARTICLE, MOCK_IMAGES);
    const zip = await JSZip.loadAsync(result.data);

    expect(zip.file("mimetype")).not.toBeNull();
    expect(zip.file("META-INF/container.xml")).not.toBeNull();
    expect(zip.file("OEBPS/content.opf")).not.toBeNull();
    expect(zip.file("OEBPS/toc.xhtml")).not.toBeNull();
    expect(zip.file("OEBPS/chapter-001.xhtml")).not.toBeNull();
    expect(zip.file("OEBPS/styles.css")).not.toBeNull();
  });

  it("should have correct mimetype content", async () => {
    const result = await buildEpub(MOCK_ARTICLE, []);
    const zip = await JSZip.loadAsync(result.data);
    const mimetype = await zip.file("mimetype")!.async("string");
    expect(mimetype).toBe("application/epub+zip");
  });

  it("should include images in OEBPS/images/", async () => {
    const result = await buildEpub(MOCK_ARTICLE, MOCK_IMAGES);
    const zip = await JSZip.loadAsync(result.data);
    expect(zip.file("OEBPS/images/img-001.jpg")).not.toBeNull();
  });

  it("should include image manifest entries in content.opf", async () => {
    const result = await buildEpub(MOCK_ARTICLE, MOCK_IMAGES);
    const zip = await JSZip.loadAsync(result.data);
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("images/img-001.jpg");
    expect(opf).toContain("image/jpeg");
  });

  it("should contain metadata in content.opf", async () => {
    const result = await buildEpub(MOCK_ARTICLE, []);
    const zip = await JSZip.loadAsync(result.data);
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("Test Article");
    expect(opf).toContain("John Doe");
    expect(opf).toContain("2026-01-15");
    expect(opf).toContain("5 min");
  });

  it("should generate correct filename", async () => {
    const result = await buildEpub(MOCK_ARTICLE, []);
    expect(result.filename).toMatch(/^2026-01-15-test-article-johndoe-.+\.kepub\.epub$/);
  });

  it("should have valid toc.xhtml", async () => {
    const result = await buildEpub(MOCK_ARTICLE, []);
    const zip = await JSZip.loadAsync(result.data);
    const toc = await zip.file("OEBPS/toc.xhtml")!.async("string");
    expect(toc).toContain("epub:type");
    expect(toc).toContain("chapter-001.xhtml");
  });

  it("should include article body in chapter", async () => {
    const result = await buildEpub(MOCK_ARTICLE, []);
    const zip = await JSZip.loadAsync(result.data);
    const chapter = await zip.file("OEBPS/chapter-001.xhtml")!.async("string");
    expect(chapter).toContain("This is test content");
    expect(chapter).toContain("John Doe (@johndoe)");
  });

  it("should work with no images", async () => {
    const result = await buildEpub(MOCK_ARTICLE, []);
    expect(result.data.length).toBeGreaterThan(0);
  });
});
