import JSZip from "jszip";
import type { ArticleData } from "../extractor/metadata.js";
import type { ImageAsset } from "../utils/images.js";
import { containerXml, contentOpf, tocXhtml, chapterXhtml } from "./templates.js";
import { EPUB_CSS } from "./styles.js";
import { buildOutputFilename } from "../utils/sanitize.js";

export interface EpubResult {
  data: Buffer;
  filename: string;
}

export async function buildEpub(article: ArticleData, images: ImageAsset[]): Promise<EpubResult> {
  const zip = new JSZip();

  // mimetype must be first entry, STORE compression, no trailing newline
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // META-INF
  zip.file("META-INF/container.xml", containerXml());

  // OEBPS
  zip.file("OEBPS/content.opf", contentOpf(article, images));
  zip.file("OEBPS/toc.xhtml", tocXhtml(article));
  zip.file("OEBPS/chapter-001.xhtml", chapterXhtml(article));
  zip.file("OEBPS/styles.css", EPUB_CSS);

  // Images
  for (const image of images) {
    zip.file(`OEBPS/images/${image.filename}`, image.data);
  }

  const data = await zip.generateAsync({ type: "nodebuffer" });
  const filename = buildOutputFilename(
    article.title,
    article.handle,
    article.sourceUrl,
    article.publishDate,
  );

  return { data: Buffer.from(data), filename };
}
