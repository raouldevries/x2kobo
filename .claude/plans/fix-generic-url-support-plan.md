# Plan: Fix Generic URL Support

> Fix bugs and quality issues found in code review and live testing of the generic URL feature branch

| Field   | Value |
|---------|-------|
| Created | 2026-03-08 |
| Status  | Planning |
| Branch  | `test/generic-url` (tracking `origin/claude/github-to-kobo-epub-kZyjL`) |
| Target  | Fix issues found in code review and live testing of the generic URL feature branch |

---

## Skills & Tools

### Default Skills

| Skill | Role |
|-------|------|
| `/audit-loop` | Each step = one audit-loop cycle (test-first, implement, self-audit, codex audit, commit) |
| `/handover` | Session transitions — create handover doc at session boundaries |
| `/code-reviewer` | Quality gate before commits — review against audit files below |

### Audit References

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions, architecture, key patterns |
| `.eslintrc.json` | Linting configuration |
| `.prettierrc` | Formatting: 100-char lines, double quotes, trailing commas |

---

## Implementation Workflow

### Per-Step Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│  1. READ PLAN                                               │
│     - Review the current step requirements                  │
│     - Understand acceptance criteria and sub-steps          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. IMPLEMENT                                               │
│     - Use `/audit-loop` Phase 1 (test-first)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. AUDIT                                                   │
│     - `/code-reviewer` against CLAUDE.md, lint, prettier    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. UPDATE PROGRESS                                         │
│     - Mark step as completed in Progress Tracking section   │
│     - Add notes about any deviations or learnings           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. CONTINUE TO NEXT STEP                                   │
│     - Automatically proceed to next step after audit passes │
│     - Run /handover after 3 completed audit-loop cycles     │
└─────────────────────────────────────────────────────────────┘
```

### Quality Gates

- [ ] `/audit-loop` was used for implementation (test-first)
- [ ] `/code-reviewer` audit passed
- [ ] Acceptance criteria from the step are met
- [ ] No regressions introduced (`npm test` passes)
- [ ] `npm run lint` and `npm run format:check` pass

---

## Context

### Current State

Branch `claude/github-to-kobo-epub-kZyjL` adds generic URL support — any HTTP(S) URL can be converted to KEPUB, not just X/Twitter articles. The feature works end-to-end but has several issues found during code review and live testing (GitHub URL returned rate-limit error page that was happily converted into a KEPUB).

### Key Patterns Found

- **Playwright page loading**: `page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })` — X path adds `waitForSelector` with parallel racing, generic path only does `waitForTimeout(3000)`
- **Content extraction**: Readability → fallback chain → `body.innerHTML` as last resort
- **Dropbox upload path**: Hardcoded in `dropbox.ts:104` as `/Apps/Rakuten Kobo/X Articles/` — the dynamic path in `convert.ts:92-93` is display-only
- **Test mocking**: Full Playwright Page mock object, `vi.mock()` for all dependencies, `beforeEach` with `vi.resetModules()` + `vi.clearAllMocks()`
- **Error handling**: `UserError` class for user-facing errors (no stack trace), all others show full trace

### Critical Gaps

1. **No content readiness signal for generic URLs** — 3s `waitForTimeout` is a guess; JS-heavy sites may not be ready
2. **No content validation** — error pages, rate-limit pages, and empty pages are silently converted to KEPUB
3. **Dropbox path mismatch** — `convert.ts` displays `/Apps/Rakuten Kobo/Articles/` but `dropbox.ts` actually uploads to `/Apps/Rakuten Kobo/X Articles/`; neither path is configurable
4. **Readability fallback includes entire body** — nav, sidebars, ads all end up in the KEPUB
5. **Draft.js preprocessing runs on all URLs** — harmless but unnecessary for non-X pages

---

## Phase 1: Page Loading & Content Readiness

### Step 1.1: Replace waitForTimeout with networkidle for generic URLs

**Complexity:** S

**Acceptance criteria:**

- [ ] Generic URLs use `waitForLoadState("networkidle")` with a timeout fallback instead of hardcoded 3s wait
- [ ] If networkidle times out, falls through gracefully (page still returned)
- [ ] X URLs are unchanged (still use existing detection logic)
- [ ] Existing tests pass; new test covers networkidle timeout fallback

**Sub-steps:**

a. In `src/extractor/article.ts`, replace the `waitForTimeout(3000)` block for non-X URLs with `page.waitForLoadState("networkidle", { timeout: 10_000 })` wrapped in try/catch
b. Add test in `src/extractor/article.test.ts` for networkidle timeout scenario (mock `waitForLoadState` rejecting)
c. Verify existing generic URL tests still pass

**Files:**

- `src/extractor/article.ts`
- `src/extractor/article.test.ts`

**Dependencies:** None

---

## Phase 2: Content Validation

### Step 2.1: Add content validation after extraction

**Complexity:** M

**Acceptance criteria:**

- [ ] After extraction, if `bodyHtml` is empty or below a minimum word threshold (e.g., <30 words), throw a `UserError` with a clear message
- [ ] Error pages with common patterns (e.g., "rate limit", "access denied", "404", "forbidden") are detected and produce a specific warning
- [ ] Validation runs for both X and generic extraction paths
- [ ] Tests cover: empty body, short body, error-page-like titles, valid content passes through

**Sub-steps:**

a. Create a `validateExtractedContent(article: ArticleData): void` function in `src/extractor/metadata.ts` that:
   - Strips HTML tags, counts words
   - Throws `UserError` if word count < 30 (roughly 1 sentence)
   - Checks title against common error patterns: `/rate limit|access denied|forbidden|not found|error|captcha|just a moment/i`
   - If error pattern matched, throws `UserError("The page returned an error instead of article content: '{title}'. Try opening the URL in a browser first.")`
b. Call `validateExtractedContent()` in `convert.ts` after the extraction stage (after `extractArticle` or `extractGenericArticle` returns)
c. Add unit tests for the validation function in `src/extractor/metadata.test.ts`
d. Add integration test in `src/commands/convert.test.ts` that verifies the pipeline rejects an error page

**Files:**

- `src/extractor/metadata.ts`
- `src/extractor/metadata.test.ts`
- `src/commands/convert.ts`
- `src/commands/convert.test.ts`

**Dependencies:** None

---

### Step 2.2: Improve Readability fallback for generic pages

**Complexity:** S

**Acceptance criteria:**

- [ ] Fallback chain tries `<article>`, then `<main>`, then `document.body` (instead of jumping straight to `body.innerHTML`)
- [ ] Tests verify the fallback priority order

**Sub-steps:**

a. In `extractGenericArticle()` in `src/extractor/metadata.ts`, change the fallback block to try `article`, `main`, then `body` selectors in order
b. Add tests in `src/extractor/metadata.test.ts` with HTML fixtures that exercise each fallback level

**Files:**

- `src/extractor/metadata.ts`
- `src/extractor/metadata.test.ts`

**Dependencies:** None

---

## Phase 3: Dropbox Upload Path Fix

### Step 3.1: Make Dropbox upload path configurable

**Complexity:** M

**Acceptance criteria:**

- [ ] `uploadToDropbox()` accepts a `dropboxPath` parameter instead of hardcoding the path
- [ ] `convert.ts` passes the correct path: `/Apps/Rakuten Kobo/X Articles/` for X URLs, `/Apps/Rakuten Kobo/Articles/` for generic URLs
- [ ] The path shown in the summary matches the actual upload path
- [ ] Existing upload tests and convert tests pass
- [ ] New test verifies different paths for X vs generic URLs

**Sub-steps:**

a. Change `uploadToDropbox(filePath, fileName)` signature to `uploadToDropbox(filePath, dropboxPath)` in `src/uploader/dropbox.ts` — remove hardcoded path construction, use the passed `dropboxPath` directly
b. Update `convert.ts` to pass the full `dropboxPath` (already constructed at line 93) to `uploadToDropbox()`
c. Update `src/uploader/dropbox.test.ts` to match new signature
d. Add test in `src/commands/convert.test.ts` verifying correct Dropbox path for X vs generic URLs

**Files:**

- `src/uploader/dropbox.ts`
- `src/uploader/dropbox.test.ts`
- `src/commands/convert.ts`
- `src/commands/convert.test.ts`

**Dependencies:** None

---

## Phase 4: Cleanup

### Step 4.1: Skip Draft.js preprocessing for generic URLs

**Complexity:** S

**Acceptance criteria:**

- [ ] `extractWithReadability()` accepts an optional `skipDraftJs` flag (or `extractGenericArticle` calls a variant without preprocessing)
- [ ] Generic URLs skip `preprocessDraftJs()` call
- [ ] X URLs still run Draft.js preprocessing
- [ ] Existing tests pass

**Sub-steps:**

a. Add an optional `options` parameter to `extractWithReadability()` with a `preprocessDraftJs` boolean (default `true`)
b. In `extractGenericArticle()`, call `extractWithReadability(html, url, { preprocessDraftJs: false })`
c. Verify existing X extraction tests still pass (they rely on Draft.js preprocessing)

**Files:**

- `src/extractor/metadata.ts`
- `src/extractor/metadata.test.ts`

**Dependencies:** None

---

### Step 4.2: Run full test suite and lint

**Complexity:** S

**Acceptance criteria:**

- [ ] `npm test` passes (all tests, no regressions)
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes

**Sub-steps:**

a. Run `npm test` and fix any failures
b. Run `npm run lint` and `npm run format:check`, fix any issues
c. Final commit with all fixes

**Files:**

- Any files needing formatting fixes

**Dependencies:** Steps 1.1, 2.1, 2.2, 3.1, 4.1

---

## Risk Areas & Recommendations

| Component | Issue | Recommendation |
|-----------|-------|----------------|
| `networkidle` wait | Some sites maintain persistent connections (analytics, websockets) causing networkidle to timeout | Use 10s timeout with graceful fallthrough — partial content is better than hanging |
| Error page detection | Regex-based title matching may false-positive on articles *about* rate limits | Keep pattern list tight; warn rather than block (or allow `--force` override later) |
| Dropbox `/Articles/` folder | New folder may not be auto-created by Dropbox API; may not sync to Kobo | Test on actual device; worst case falls back to X Articles folder |
| Draft.js skip | Removing preprocessing for generic URLs changes code path | Low risk — selectors won't match on non-X HTML anyway |

### Breaking Changes

- `uploadToDropbox()` signature changes from `(filePath, fileName)` to `(filePath, dropboxPath)` — internal API only, no external consumers

### Testing Recommendations

- After all steps complete, do a live test with a real generic URL (e.g., a blog post) and verify the KEPUB content on a Kobo device
- Test the error page detection with the GitHub rate-limit URL to confirm it now rejects properly

### Quick Wins

- Step 1.1 (networkidle) and Step 4.1 (skip Draft.js) are small, independent changes that can be done first

---

## Progress Tracking

### Phase 1: Page Loading & Content Readiness
- [x] Step 1.1: Replace waitForTimeout with networkidle for generic URLs _(completed 2026-03-08)_

### Phase 2: Content Validation
- [x] Step 2.1: Add content validation after extraction _(completed 2026-03-08)_
- [x] Step 2.2: Improve Readability fallback for generic pages _(completed 2026-03-08)_

### Phase 3: Dropbox Upload Path Fix
- [x] Step 3.1: Make Dropbox upload path configurable _(completed 2026-03-08)_

### Phase 4: Cleanup
- [x] Step 4.1: Skip Draft.js preprocessing for generic URLs _(completed 2026-03-08)_
- [x] Step 4.2: Run full test suite and lint _(completed 2026-03-08)_
