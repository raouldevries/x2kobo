import type { BrowserContext } from "playwright";
import { JSDOM } from "jsdom";
import { verbose } from "./logger.js";

const CONCURRENCY = 4;

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

interface DownloadJob {
  img: Element;
  src: string;
  index: number;
}

async function downloadOne(
  job: DownloadJob,
  context: BrowserContext,
): Promise<{ job: DownloadJob; asset: ImageAsset } | null> {
  const downloadUrl = transformTwimgUrl(job.src);
  verbose(`Downloading image ${job.index + 1}: ${downloadUrl}`);

  try {
    const response = await context.request.get(downloadUrl);
    if (!response.ok()) {
      verbose(`Failed (${response.status()}): ${downloadUrl}`);
      return null;
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
        return null;
      }
    }

    const ext = extensionForMime(mime);
    const filename = `img-${String(job.index + 1).padStart(3, "0")}${ext}`;
    verbose(`Downloaded image ${job.index + 1}: ${filename} (${(data.length / 1024).toFixed(1)} KB)`);

    return { job, asset: { filename, data, mediaType: mime } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    verbose(`Error downloading image ${job.index + 1}: ${message}`);
    return null;
  }
}

export async function downloadImages(html: string, context: BrowserContext): Promise<ImageResult> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const imgElements = doc.querySelectorAll("img");
  const totalFound = imgElements.length;

  // Build download jobs, filtering out profile images and empty srcs
  const jobs: DownloadJob[] = [];
  const skipped: Element[] = [];
  let imgIndex = 0;

  for (const img of imgElements) {
    const src = img.getAttribute("src");
    if (!src || src.includes("profile_images")) {
      skipped.push(img);
      continue;
    }
    jobs.push({ img, src, index: imgIndex });
    imgIndex++;
  }

  // Remove skipped images from DOM
  for (const img of skipped) {
    img.remove();
  }

  // Deduplicate jobs by URL — download each unique URL only once
  const uniqueJobs: DownloadJob[] = [];
  const seenUrls = new Map<string, DownloadJob[]>(); // url -> list of duplicate jobs
  for (const job of jobs) {
    const url = transformTwimgUrl(job.src);
    const existing = seenUrls.get(url);
    if (existing) {
      existing.push(job);
    } else {
      seenUrls.set(url, []);
      uniqueJobs.push(job);
    }
  }

  const duplicateCount = jobs.length - uniqueJobs.length;
  verbose(
    `Found ${totalFound} img tags, ${jobs.length} to download` +
      (duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : "") +
      ` (concurrency: ${CONCURRENCY})`,
  );

  // Download in parallel with concurrency limit
  const images: ImageAsset[] = [];
  const failedJobs: DownloadJob[] = [];

  for (let i = 0; i < uniqueJobs.length; i += CONCURRENCY) {
    const batch = uniqueJobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((job) => downloadOne(job, context)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result) {
        images.push(result.asset);
        result.job.img.setAttribute("src", `images/${result.asset.filename}`);

        // Point duplicate img tags to the same downloaded asset
        const url = transformTwimgUrl(result.job.src);
        for (const dup of seenUrls.get(url) || []) {
          dup.img.setAttribute("src", `images/${result.asset.filename}`);
        }
      } else {
        failedJobs.push(batch[j]);
        batch[j].img.remove();
        // Also remove duplicate img tags for failed URLs
        const url = transformTwimgUrl(batch[j].src);
        for (const dup of seenUrls.get(url) || []) {
          dup.img.remove();
        }
      }
    }
  }

  if (failedJobs.length > 0) {
    verbose(`${failedJobs.length} image(s) failed to download`);
  }

  return {
    html: doc.body.innerHTML,
    images,
    totalFound,
    totalDownloaded: images.length,
  };
}
