import type { BrowserContext } from "playwright";
import { JSDOM } from "jsdom";

export interface ImageAsset {
  filename: string;
  data: Buffer;
  mediaType: string;
}

export interface ImageResult {
  html: string;
  images: ImageAsset[];
  totalFound: number;
  totalDownloaded: number;
}

function transformTwimgUrl(src: string): string {
  try {
    const url = new URL(src);
    if (url.hostname === "pbs.twimg.com") {
      url.searchParams.set("format", "jpg");
      url.searchParams.set("name", "large");
    }
    return url.toString();
  } catch {
    return src;
  }
}

function detectMimeType(data: Buffer, contentType?: string): string {
  if (contentType && contentType !== "application/octet-stream") {
    return contentType;
  }

  // Check magic bytes
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return "image/png";
  if (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  )
    return "image/webp";
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38)
    return "image/gif";

  return "image/jpeg";
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

async function convertWebpToJpeg(data: Buffer): Promise<{ data: Buffer; mime: string } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const converted = await sharp(data).jpeg({ quality: 90 }).toBuffer();
    return { data: Buffer.from(converted), mime: "image/jpeg" };
  } catch {
    console.warn("WebP image skipped (sharp not available) — install sharp for image support");
    return null;
  }
}

export async function downloadImages(html: string, context: BrowserContext): Promise<ImageResult> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const imgElements = doc.querySelectorAll("img");
  const images: ImageAsset[] = [];
  const totalFound = imgElements.length;
  let imgIndex = 0;

  for (const img of imgElements) {
    const src = img.getAttribute("src");
    if (!src) {
      img.remove();
      continue;
    }

    const downloadUrl = transformTwimgUrl(src);

    try {
      const response = await context.request.get(downloadUrl);
      if (!response.ok()) {
        console.warn(`Failed to download image: ${downloadUrl} (${response.status()})`);
        img.remove();
        continue;
      }

      let data: Buffer = Buffer.from(await response.body()) as Buffer;
      const contentType = response.headers()["content-type"]?.split(";")[0]?.trim();
      let mime = detectMimeType(data, contentType);

      if (mime === "image/webp") {
        const converted = await convertWebpToJpeg(data);
        if (converted) {
          data = converted.data;
          mime = converted.mime;
        } else {
          img.remove();
          continue;
        }
      }

      const ext = extensionForMime(mime);
      const filename = `img-${String(imgIndex + 1).padStart(3, "0")}${ext}`;
      imgIndex++;

      images.push({ filename, data, mediaType: mime });
      img.setAttribute("src", `images/${filename}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to download image: ${message}`);
      img.remove();
    }
  }

  return {
    html: doc.body.innerHTML,
    images,
    totalFound,
    totalDownloaded: images.length,
  };
}
