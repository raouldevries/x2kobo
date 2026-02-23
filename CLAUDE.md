# x2kobo

Convert X (Twitter) Articles to KEPUB files for Kobo e-readers, with Dropbox upload.

## Commands

```bash
npm run dev           # Run CLI without build (tsx src/cli.ts)
npm run build         # Compile TypeScript
npm test              # Run tests (vitest)
npm run lint          # ESLint
npm run format:check  # Prettier check
```

## Architecture

CLI tool with a 5-stage pipeline: **Load → Extract → Generate → Save → Upload**

```
src/
├── cli.ts              # Commander.js entry point, global error handler
├── commands/           # CLI commands (convert, batch, login, auth, status, config)
├── extractor/          # Playwright browser context, article loading, Readability extraction
├── generator/          # EPUB ZIP structure, KEPUB span insertion, e-ink CSS
├── uploader/           # Dropbox OAuth PKCE, token refresh, upload with retry
├── config/             # Config persistence (~/.x2kobo/), CLI option merging
└── utils/              # UserError, image download/conversion, logger (ora), sanitize
```

## Key Patterns

- **UserError** for user-facing errors (printed without stack trace); all others show full trace
- **Atomic writes** for config (temp file → rename)
- **Singleton browser context** reused across batch conversions
- **KEPUB transform**: TreeWalker wraps text nodes in `<span class="koboSpan">`, skips pre/code/script/style/svg/math
- **Image pipeline**: concurrent downloads (4), twimg URL transform for max quality, WebP→JPEG via sharp
- **Dropbox retry**: 3x exponential backoff (1s, 2s, 4s)

## Conventions

- TypeScript strict mode, ES2022 target, ESM modules
- Prettier: 100-char lines, double quotes, trailing commas
- Tests colocated (`src/**/*.test.ts`), fixtures use JSDOM, no real browser/API in CI
- Output filenames: `{YYYY-MM-DD}-{title}-{handle}-{hash}.kepub.epub`
- Config stored at `~/.x2kobo/` (session cookies in `browser-data/`, tokens in `config.json`)
