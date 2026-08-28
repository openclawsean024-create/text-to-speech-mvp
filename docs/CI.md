# CI Pipeline

This project has **two complementary CI systems**:

1. **`pnpm run ci` script** — runs locally and in Vercel builds
2. **GitHub Actions workflow** (recommended, requires manual setup) — runs in PR + push to master

## 1. Local pnpm run ci

```bash
# Run full CI locally
pnpm run ci

# Equivalent to:
pnpm run typecheck   # tsc --noEmit
pnpm run lint         # next lint
pnpm run smoke        # node scripts/ci-smoke.js (8 critical tests)
pnpm run build        # next build (includes typecheck + lint)
```

The `smoke` step verifies:
- ✅ 5 TTS engines registered
- ✅ SRT/VTT formatters produce valid output
- ✅ ePub builder produces ≥ 100 byte archive
- ✅ Webhook HMAC sign/verify roundtrip
- ✅ NewebPay 3-tier config present
- ✅ TTS prompt catalog: 5 engines, 12 emotions, 12 roles, 12 presets
- ✅ 繁中 text normalization function exported

`prebuild` is also wired: any `pnpm run build` runs `pnpm run smoke` first.

## 2. Vercel build integration

Vercel runs `pnpm run build` (= `pnpm run smoke && next build`) on every push. The `smoke` step **fails the build** if any critical v3.0 module is broken.

The `buildCommand` in `vercel.json` is set to `pnpm run ci` for explicit control.

## 3. GitHub Actions workflow (recommended)

Create `.github/workflows/ci.yml` with the content below. The file content cannot be auto-pushed via this agent due to a GitHub OAuth App `workflow` scope restriction — operator must create it manually via the GitHub web UI.

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  build:
    name: Build + Lint + Typecheck + Smoke Test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Install dependencies
        run: pnpm install --prefer-offline

      - name: Run CI (typecheck + lint + smoke + build)
        run: pnpm run ci

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: .next/
```

## Smoke test details (`scripts/ci-smoke.js`)

```js
const tts = require('../lib/tts-engines.js')
// Expect 5 engines: openai, elevenlabs, kokoro, azure, google

const pp = require('../lib/post-process.js')
// SRT format: 00:00:00,000 --> 00:00:05,000
// VTT format: WEBVTT header

const epub = require('../lib/epub.js')
// Returns valid zip with mimetype, container, opf, ncx, xhtml

const wh = require('../lib/webhook.js')
// HMAC-SHA256 sign/verify roundtrip

const np = require('../lib/newebpay.js')
// 3 tiers: personal (NT$99), creator (NT$299), business (NT$2,999)

const tp = require('../lib/tts-prompts.js')
// Catalog: 5 engines, 12 emotions, 12 roles, 12 presets
```

## Why both?

- **`pnpm run ci` script** is always present, testable locally, runs in Vercel builds. Self-contained, no GitHub App needed.
- **GitHub Actions workflow** provides PR-time CI gating, branch protection, status checks. Requires the `.github/workflows/ci.yml` file which is operator-pasted due to OAuth scope.
