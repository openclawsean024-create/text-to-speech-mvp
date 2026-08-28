# CI Pipeline Setup

This document describes the GitHub Actions CI pipeline for the text-to-speech-mvp project. The workflow file (`.github/workflows/ci.yml`) must be created manually on GitHub because the OAuth App used by this agent doesn't have `workflow` scope.

## Workflow file

Create `.github/workflows/ci.yml` with the following content:

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  build:
    name: Build & Typecheck
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

      - name: TypeScript typecheck
        run: npx tsc --noEmit

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_demo
          CLERK_SECRET_KEY: sk_test_demo
          OPENAI_API_KEY: sk-demo
          KV_REST_API_URL: https://demo.kv
          KV_REST_API_TOKEN: demo

      - name: Smoke test
        run: |
          node -e "
            const tts = require('./lib/tts-engines.js');
            console.log('TTS engines loaded:', tts.SUPPORTED_ENGINES);
            const pp = require('./lib/post-process.js');
            const srt = pp.toSrt([{start: 0, end: 5, text: '哈囉'}]);
            if (!srt.includes('00:00:00,000')) throw new Error('SRT format broken');
            const vtt = pp.toVtt([{start: 0, end: 5, text: '哈囉'}]);
            if (!vtt.startsWith('WEBVTT')) throw new Error('VTT format broken');
            const epub = require('./lib/epub.js');
            const buf = epub.buildEpub({title: 't', chapters: [], segments: [{start:0,end:1,text:'x'}]});
            if (buf.length < 100) throw new Error('ePub build failed');
            const wh = require('./lib/webhook.js');
            const sig = wh.signPayload('test');
            if (!wh.verifyPayload('test', sig)) throw new Error('webhook sign/verify broken');
            const np = require('./lib/newebpay.js');
            if (!np.NEWEBPAY_TIERS.personal) throw new Error('NewebPay tiers missing');
            const tp = require('./lib/tts-prompts.js');
            const cat = tp.getCatalog();
            if (cat.engines.length !== 5) throw new Error('Expected 5 engines');
            console.log('ALL SMOKE TESTS PASSED');
          "
```

## What it does

1. **Checkout** — pulls the repo
2. **Setup Node 20 + pnpm 11** — fast install with cache
3. **Install** — `pnpm install --prefer-offline`
4. **Typecheck** — `npx tsc --noEmit` (catches type errors)
5. **Build** — `pnpm build` (Next.js production build)
6. **Smoke test** — loads all critical modules and verifies:
   - 5 TTS engines registered
   - SRT/VTT formatters produce valid output
   - ePub builder produces ≥ 100 bytes
   - Webhook HMAC sign/verify roundtrip
   - NewebPay tier config present
   - TTS prompt catalog has 5 engines

## Setup steps

1. Create `.github/workflows/ci.yml` with the content above
2. Push to `master` — the workflow runs automatically
3. (Optional) Add a branch protection rule requiring CI to pass before merge

## Status

The repository has a `deploy.yml` workflow (in `.github/workflows/`) that handles production deployment to Vercel. Adding `ci.yml` will give you CI on every PR.
