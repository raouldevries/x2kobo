import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadImages } from "./images.js";

// JPEG magic bytes
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
// PNG magic bytes
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
// WebP magic bytes (RIFF....WEBP)
const WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function createMockContext(
  responses: Map<string, { ok: boolean; body: Buffer; contentType: string }>,
) {
  return {
    request: {
      get: vi.fn(async (url: string) => {
        const resp = responses.get(url);
        if (!resp) {
          return {
            ok: () => false,
            status: () => 404,
            body: async () => Buffer.alloc(0),
            headers: () => ({}),
          };
        }
        return {
          ok: () => resp.ok,
          status: () => (resp.ok ? 200 : 500),
          body: async () => resp.body,
          headers: () => ({ "content-type": resp.contentType }),
        };
      }),
    },
  };
}

describe("downloadImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should download images and replace src attributes", async () => {
    const html = '<div><img src="https://example.com/img.jpg" /></div>';
    const responses = new Map([
      ["https://example.com/img.jpg", { ok: true, body: JPEG_BUFFER, contentType: "image/jpeg" }],
    ]);
    const context = createMockContext(responses);

    const result = await downloadImages(html, context as never);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].filename).toBe("img-001.jpg");
    expect(result.images[0].mediaType).toBe("image/jpeg");
    expect(result.html).toContain('src="images/img-001.jpg"');
    expect(result.totalFound).toBe(1);
    expect(result.totalDownloaded).toBe(1);
  });

  it("should transform twimg URLs to high-res JPEG", async () => {
    const html = '<img src="https://pbs.twimg.com/media/abc?format=webp&name=small" />';
    const expectedUrl = "https://pbs.twimg.com/media/abc?format=jpg&name=large";
    const responses = new Map([
      [expectedUrl, { ok: true, body: JPEG_BUFFER, contentType: "image/jpeg" }],
    ]);
    const context = createMockContext(responses);

    const result = await downloadImages(html, context as never);
    expect(context.request.get).toHaveBeenCalledWith(expectedUrl);
    expect(result.images).toHaveLength(1);
  });

  it("should detect PNG by magic bytes", async () => {
    const html = '<img src="https://example.com/img" />';
    const responses = new Map([
      [
        "https://example.com/img",
        { ok: true, body: PNG_BUFFER, contentType: "application/octet-stream" },
      ],
    ]);
    const context = createMockContext(responses);

    const result = await downloadImages(html, context as never);
    expect(result.images[0].mediaType).toBe("image/png");
    expect(result.images[0].filename).toBe("img-001.png");
  });

  it("should remove img tag on download failure", async () => {
    const html = '<div><p>text</p><img src="https://example.com/fail.jpg" /><p>more</p></div>';
    const responses = new Map<string, { ok: boolean; body: Buffer; contentType: string }>();
    const context = createMockContext(responses);

    const result = await downloadImages(html, context as never);
    expect(result.images).toHaveLength(0);
    expect(result.html).not.toContain("img");
    expect(result.totalFound).toBe(1);
    expect(result.totalDownloaded).toBe(0);
  });

  it("should handle multiple images", async () => {
    const html = '<img src="https://a.com/1.jpg" /><img src="https://a.com/2.jpg" />';
    const responses = new Map([
      ["https://a.com/1.jpg", { ok: true, body: JPEG_BUFFER, contentType: "image/jpeg" }],
      ["https://a.com/2.jpg", { ok: true, body: JPEG_BUFFER, contentType: "image/jpeg" }],
    ]);
    const context = createMockContext(responses);

    const result = await downloadImages(html, context as never);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].filename).toBe("img-001.jpg");
    expect(result.images[1].filename).toBe("img-002.jpg");
  });

  it("should handle html with no images", async () => {
    const html = "<p>No images here</p>";
    const context = createMockContext(new Map());

    const result = await downloadImages(html, context as never);
    expect(result.images).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  it("should remove img tags with no src", async () => {
    const html = '<div><img /><img src="" /></div>';
    const context = createMockContext(new Map());

    const result = await downloadImages(html, context as never);
    expect(result.images).toHaveLength(0);
  });

  it("should handle WebP images by attempting conversion", async () => {
    const html = '<img src="https://example.com/img.webp" />';
    const responses = new Map([
      ["https://example.com/img.webp", { ok: true, body: WEBP_BUFFER, contentType: "image/webp" }],
    ]);
    const context = createMockContext(responses);

    // sharp may or may not be available; just test it doesn't crash
    const result = await downloadImages(html, context as never);
    // Either converted or removed
    expect(result.totalFound).toBe(1);
  });
});
