import type { ArticleData } from "../extractor/metadata.js";
import type { ImageAsset } from "../utils/images.js";

export function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function contentOpf(article: ArticleData, images: ImageAsset[]): string {
  const date = article.publishDate
    ? new Date(article.publishDate).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const imageManifest = images
    .map(
      (img, i) =>
        `    <item id="image-${i + 1}" href="images/${img.filename}" media-type="${img.mediaType}"/>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${article.sourceUrl}</dc:identifier>
    <dc:title>${escapeXml(article.title)}</dc:title>
    <dc:creator>${escapeXml(article.author)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>${date}</dc:date>
    <dc:source>${escapeXml(article.sourceUrl)}</dc:source>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
    <meta property="schema:readingTime">${article.readingTime} min</meta>
  </metadata>
  <manifest>
    <item id="chapter-001" href="chapter-001.xhtml" media-type="application/xhtml+xml"/>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
${imageManifest}
  </manifest>
  <spine>
    <itemref idref="chapter-001"/>
  </spine>
</package>`;
}

export function tocXhtml(article: ArticleData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(article.title)}</title>
</head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="chapter-001.xhtml">${escapeXml(article.title)}</a></li>
    </ol>
  </nav>
</body>
</html>`;
}

export function chapterXhtml(article: ArticleData): string {
  const dateStr = article.publishDate
    ? new Date(article.publishDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const authorLine = article.handle
    ? `${escapeXml(article.author)} (${escapeXml(article.handle)})`
    : escapeXml(article.author);

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(article.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="article-meta">
    <h1>${escapeXml(article.title)}</h1>
    <p class="author">${authorLine}</p>
    ${dateStr ? `<p class="date">${dateStr}</p>` : ""}
    <p class="reading-time">${article.readingTime} min read</p>
  </div>
  ${article.bodyHtml}
</body>
</html>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
