# Contributing

## Dev Setup

```bash
git clone <repo-url>
cd x2kobo
npm install
npx playwright install chromium
```

## Build

```bash
npm run build    # TypeScript compilation
npm run dev      # Run directly with tsx (no build needed)
```

## Test

```bash
npm test         # Run all unit tests
```

## Code Style

- TypeScript with strict mode
- ESLint for linting: `npm run lint`
- Prettier for formatting: `npm run format`
- Check formatting: `npm run format:check`

### Conventions

- Use `UserError` for user-facing errors (prints message without stack trace)
- All other errors print full stack traces
- Browser-dependent tests use mocks (no real browser in CI)
- Dropbox-dependent tests use mocks (no real API calls)
