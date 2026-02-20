# x2kobo

Convert X (Twitter) Articles into KEPUB files for Kobo e-readers, with optional Dropbox upload.

## What it does

x2kobo takes an X Article URL, extracts the content using a headless browser, converts it to a well-formatted KEPUB e-book file optimized for Kobo e-readers, and optionally uploads it to Dropbox for automatic syncing to your device.

## Prerequisites

- Node.js 18+
- Chromium browser (installed via Playwright)

## Installation

```bash
npm install -g x2kobo
```

Or run directly with npx:

```bash
npx x2kobo <url>
```

## Quick Start

### 1. Install the browser

```bash
npx playwright install chromium
```

### 2. Log into X

```bash
npx x2kobo login
```

This opens a browser window. Log into your X account, then press Enter in the terminal.

### 3. (Optional) Set up Dropbox

Create a Dropbox app:

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access" and "Full Dropbox"
4. Name your app (e.g., "x2kobo")
5. Under Permissions, enable `files.content.write`
6. Copy the App Key

Then authorize:

```bash
npx x2kobo auth
```

Enter your App Key when prompted, open the authorization URL in your browser, and paste the code.

### 4. Convert an article

```bash
npx x2kobo https://x.com/username/article/123456
```

The KEPUB file is saved locally and uploaded to `/Apps/Rakuten Kobo/X Articles/` in your Dropbox, where your Kobo e-reader will automatically sync it.

## Commands

| Command | Description |
|---------|-------------|
| `x2kobo <url>` | Convert an X Article to KEPUB |
| `x2kobo convert <url>` | Same as above (explicit) |
| `x2kobo login` | Log into X in a browser window |
| `x2kobo auth` | Set up Dropbox OAuth |
| `x2kobo status` | Show login and Dropbox status |

## Options

| Flag | Description |
|------|-------------|
| `--no-upload` | Skip Dropbox upload, save locally only |
| `-o, --output <path>` | Set output file path |
| `--debug` | Show the browser window during conversion |
| `-v, --verbose` | Show verbose debug output |
| `--version` | Show version |
| `--help` | Show help |

## How it works

1. **Load** - Opens the X Article URL in a headless Chromium browser using your saved session
2. **Extract** - Parses the article content using Mozilla Readability, extracts metadata and downloads images
3. **Generate** - Builds an EPUB 3 file with e-ink optimized styling and Kobo-specific span markup (KEPUB)
4. **Upload** - Uploads the `.kepub.epub` file to Dropbox for automatic Kobo sync

## Output

Files are saved as: `{date}-{title}-{handle}-{hash}.kepub.epub`

Example: `2026-01-15-my-article-johndoe-abc123.kepub.epub`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Browser not found" | Run `npx playwright install chromium` |
| "Run `npx x2kobo login`" | Your X session expired, log in again |
| "This appears to be a regular tweet" | The URL points to a tweet, not an X Article |
| "Run `npx x2kobo auth`" | Dropbox not configured, run auth setup |
| Upload fails | File is saved locally; check Dropbox quota |

## License

MIT
