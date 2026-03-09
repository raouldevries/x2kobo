import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "playwright";
import { loadArticle } from "../extractor/article.js";
import { fetchArticle } from "../extractor/fetch.js";
import {
  extractArticle,
  extractGenericArticle,
  validateExtractedContent,
} from "../extractor/metadata.js";
import { downloadImages, httpClientFromFetch, type HttpClient } from "../utils/images.js";
import { isXUrl } from "../utils/sanitize.js";
import { buildEpub } from "../generator/epub.js";
import { transformToKepub } from "../generator/kepub.js";
import { uploadToDropbox } from "../uploader/dropbox.js";
import { closeBrowser } from "../extractor/browser.js";
import {
  startSpinner,
  succeedSpinner,
  failSpinner,
  stopSpinner,
  printSummary,
  setVerbose,
  verbose,
} from "../utils/logger.js";
import { isUserError } from "../utils/errors.js";

export interface ConvertOptions {
  noUpload?: boolean;
  output?: string;
  verbose?: boolean;
  useChrome?: boolean;
  debug?: boolean;
  keepBrowserOpen?: boolean;
}

export async function convert(url: string, options: ConvertOptions): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  try {
    // Stage 1: Load page
    const isX = isXUrl(url);
    startSpinner(isX ? "Loading article..." : "Loading page...");
    verbose(`URL: ${url}`);
    verbose(
      `Options: debug=${!!options.debug}, useChrome=${!!options.useChrome}, noUpload=${!!options.noUpload}`,
    );

    let pageContent: string;
    let pageTitle: string;
    let pageUrl: string;
    let imageClient: HttpClient;
    let page: Page | null = null;

    if (isX) {
      // X URLs always need Playwright for session cookies
      page = await loadArticle(url, {
        useSystemChrome: options.useChrome,
        headless: !options.debug,
      });
      pageContent = await page.content();
      pageTitle = await page.title();
      pageUrl = page.url();
      imageClient = page.context() as unknown as HttpClient;
    } else {
      // Generic URLs: try HTTP fetch first, fall back to Playwright
      try {
        const result = await fetchArticle(url);
        pageContent = result.html;
        pageTitle = result.title;
        pageUrl = result.url;
        imageClient = httpClientFromFetch();
        verbose("Loaded via HTTP fetch (no browser needed)");
      } catch (fetchError: unknown) {
        const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        verbose(`Fetch failed (${msg}), falling back to browser...`);
        page = await loadArticle(url, {
          useSystemChrome: options.useChrome,
          headless: !options.debug,
        });
        pageContent = await page.content();
        pageTitle = await page.title();
        pageUrl = page.url();
        imageClient = page.context() as unknown as HttpClient;
      }
    }

    verbose(`Page title: ${pageTitle}`);
    verbose(`Page URL after navigation: ${pageUrl}`);
    verbose(`Page content length: ${pageContent.length} chars`);
    succeedSpinner(isX ? "Article loaded" : "Page loaded");

    // Stage 2: Extract content
    startSpinner("Extracting content...");
    const article = isX
      ? extractArticle(pageContent, url, pageTitle)
      : extractGenericArticle(pageContent, url, pageTitle);
    validateExtractedContent(article);
    verbose(`Extracted title: ${article.title}`);
    verbose(`Author: ${article.author} (${article.handle})`);
    verbose(`Word count: ~${article.readingTime * 230} words`);
    const imageResult = await downloadImages(article.bodyHtml, imageClient);
    article.bodyHtml = imageResult.html;
    succeedSpinner(
      `Extracted: ${article.title} (${article.readingTime} min read, ${imageResult.totalDownloaded} images)`,
    );

    // Stage 3: Generate KEPUB
    startSpinner("Generating KEPUB...");
    const epub = await buildEpub(article, imageResult.images);
    verbose(`EPUB filename: ${epub.filename}`);

    // Apply KEPUB transformation to the chapter inside the zip
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(epub.data);
    const chapterContent = await zip.file("OEBPS/chapter-001.xhtml")!.async("string");
    const kepubContent = transformToKepub(chapterContent, 1);
    zip.file("OEBPS/chapter-001.xhtml", kepubContent);
    const finalData = await zip.generateAsync({ type: "nodebuffer" });
    succeedSpinner("KEPUB generated");

    // Stage 4: Save file
    const outputPath = options.output
      ? resolve(options.output)
      : resolve(process.cwd(), epub.filename);
    writeFileSync(outputPath, finalData);

    // Stage 5: Upload to Dropbox
    let uploaded = false;
    const dropboxFolder = isX ? "X Articles" : "Articles";
    const dropboxPath = `/Apps/Rakuten Kobo/${dropboxFolder}/${epub.filename}`;
    if (!options.noUpload) {
      startSpinner("Uploading to Dropbox...");
      try {
        await uploadToDropbox(outputPath, dropboxPath);
        succeedSpinner("Uploaded to Dropbox");
        uploaded = true;
      } catch (error: unknown) {
        if (isUserError(error)) {
          failSpinner(`Upload skipped: ${(error as Error).message}`);
        } else {
          failSpinner("Upload failed, file saved locally");
        }
      }
    }

    if (page) {
      if (options.keepBrowserOpen) {
        await page.close();
      } else {
        await closeBrowser();
      }
    }

    printSummary({
      title: article.title,
      author: article.handle ? `${article.author} (${article.handle})` : article.author,
      readingTime: article.readingTime,
      imageCount: imageResult.totalDownloaded,
      totalImages: imageResult.totalFound,
      fileSize: finalData.length,
      filePath: outputPath,
      uploaded,
      dropboxPath: uploaded ? dropboxPath : undefined,
    });
  } catch (error: unknown) {
    stopSpinner();
    await closeBrowser();
    throw error;
  }
}
