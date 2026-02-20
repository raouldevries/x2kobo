import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadArticle } from "../extractor/article.js";
import { extractArticle } from "../extractor/metadata.js";
import { downloadImages } from "../utils/images.js";
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
} from "../utils/logger.js";
import { isUserError } from "../utils/errors.js";

export interface ConvertOptions {
  noUpload?: boolean;
  output?: string;
  verbose?: boolean;
  useChrome?: boolean;
}

export async function convert(url: string, options: ConvertOptions): Promise<void> {
  try {
    // Stage 1: Load article page
    startSpinner("Loading article...");
    const page = await loadArticle(url, { useSystemChrome: options.useChrome });
    const pageContent = await page.content();
    const pageTitle = await page.title();
    succeedSpinner("Article loaded");

    // Stage 2: Extract content
    startSpinner("Extracting content...");
    const article = extractArticle(pageContent, url, pageTitle);
    const context = page.context();
    const imageResult = await downloadImages(article.bodyHtml, context);
    article.bodyHtml = imageResult.html;
    succeedSpinner(
      `Extracted: ${article.title} (${article.readingTime} min read, ${imageResult.totalDownloaded} images)`,
    );

    // Stage 3: Generate KEPUB
    startSpinner("Generating KEPUB...");
    const epub = await buildEpub(article, imageResult.images);

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
    const dropboxPath = `/Apps/x2kobo/${epub.filename}`;
    if (!options.noUpload) {
      startSpinner("Uploading to Dropbox...");
      try {
        await uploadToDropbox(outputPath, epub.filename);
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

    await closeBrowser();

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
