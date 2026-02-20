export const EPUB_CSS = `
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.65;
  text-align: justify;
  hyphens: auto;
  -webkit-hyphens: auto;
  margin: 1em;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-family: Helvetica, Arial, sans-serif;
  text-align: left;
  hyphens: none;
  -webkit-hyphens: none;
  page-break-after: avoid;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

h1 { font-size: 1.6em; }
h2 { font-size: 1.3em; }
h3 { font-size: 1.1em; }

p {
  margin: 0.8em 0;
  text-indent: 0;
}

a {
  text-decoration: underline;
}

blockquote {
  margin: 1em 1.5em;
  padding-left: 0.5em;
  border-left: 2px solid #666;
  font-style: italic;
}

pre, code {
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9em;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 1em 0;
  padding: 0.5em;
  border: 1px solid #ccc;
}

code {
  padding: 0.1em 0.3em;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}

ul, ol {
  margin: 0.8em 0;
  padding-left: 2em;
}

li {
  margin: 0.3em 0;
}

.article-meta {
  margin-bottom: 2em;
  border-bottom: 1px solid #ccc;
  padding-bottom: 1em;
}

.article-meta .author {
  font-weight: bold;
}

.article-meta .date {
  font-size: 0.9em;
}

.article-meta .reading-time {
  font-size: 0.9em;
}
`.trim();
