import { JSDOM } from "jsdom";

const SKIP_ELEMENTS = new Set(["pre", "code", "script", "style", "svg", "math"]);

function isInsideSkipElement(node: Node): boolean {
  let current = node.parentElement;
  while (current) {
    if (SKIP_ELEMENTS.has(current.tagName.toLowerCase())) return true;
    current = current.parentElement;
  }
  return false;
}

function isAlreadyWrapped(node: Node): boolean {
  const parent = node.parentElement;
  return parent?.classList.contains("koboSpan") ?? false;
}

export function transformToKepub(xhtml: string, chapterIndex: number): string {
  const dom = new JSDOM(xhtml, { contentType: "application/xhtml+xml" });
  const doc = dom.window.document;
  const body = doc.body;

  if (!body) return xhtml;

  // Walk text nodes and wrap in koboSpan
  let counter = 1;
  const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  const textNodes: Node[] = [];

  let node = walker.nextNode();
  while (node) {
    textNodes.push(node);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    if (!textNode.textContent || /^\s*$/.test(textNode.textContent)) continue;
    if (isInsideSkipElement(textNode)) continue;
    if (isAlreadyWrapped(textNode)) continue;

    const span = doc.createElement("span");
    span.setAttribute("class", "koboSpan");
    span.setAttribute("id", `kobo.${chapterIndex}.${counter}`);
    span.textContent = textNode.textContent;
    textNode.parentNode?.replaceChild(span, textNode);
    counter++;
  }

  // Wrap body content in book-inner > book-columns
  const bookInner = doc.createElement("div");
  bookInner.setAttribute("class", "book-inner");
  const bookColumns = doc.createElement("div");
  bookColumns.setAttribute("class", "book-columns");

  while (body.firstChild) {
    bookColumns.appendChild(body.firstChild);
  }
  bookInner.appendChild(bookColumns);
  body.appendChild(bookInner);

  // Serialize to XHTML
  const serializer = new dom.window.XMLSerializer();
  let output = serializer.serializeToString(doc.documentElement);

  // Ensure xmlns is present
  if (!output.includes('xmlns="http://www.w3.org/1999/xhtml"')) {
    output = output.replace("<html", '<html xmlns="http://www.w3.org/1999/xhtml"');
  }

  // Fix void elements for XHTML compliance
  output = output.replace(/<(br|hr|img|input|link|meta)([^/>]*?)>/g, "<$1$2/>");

  return `<?xml version="1.0" encoding="UTF-8"?>\n${output}`;
}
