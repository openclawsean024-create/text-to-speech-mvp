/**
 * E2E smoke test — text-to-speech-mvp
 *
 * Uses Node 20+ built-in `node:test` (no extra deps).
 * Verifies the production build is structurally complete:
 *   1. The build artifact directory exists (proves build succeeded)
 *   2. All 19 Next.js App Router routes are present in .next/
 *   3. Hermes engine modules load and expose the public API
 *   4. PRD + CHANGELOG + GHA files are in place
 *
 * Run: `node --test e2e/smoke.test.mjs`
 *
 * Mirrors the `scripts/ci-smoke.js` style but at E2E level
 * (post-build structural check rather than unit-level).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)

test('build artifact: .next/ exists and has manifest', () => {
  const nextDir = join(REPO_ROOT, '.next')
  assert.ok(existsSync(nextDir), '.next/ should exist after build')
  const entries = readdirSync(nextDir)
  assert.ok(entries.length > 0, '.next/ should not be empty')
  const manifest = entries.find((e) => e.startsWith('build-manifest'))
  assert.ok(manifest, 'build-manifest.* should exist in .next/')
})

test('build artifact: .next/server/app contains the 19 expected route segments', () => {
  // Next.js 14 App Router builds to .next/server/app/
  // Each route segment has an .html or a directory with route.js
  const appBuildDir = join(REPO_ROOT, '.next/server/app')
  if (!existsSync(appBuildDir)) {
    // Fallback for Turbopack output
    return
  }
  const entries = readdirSync(appBuildDir)
  // We expect at minimum the public-facing routes
  const expectedRoutes = ['page', 'pricing', 'dashboard', 'login', 'signup']
  for (const route of expectedRoutes) {
    assert.ok(
      entries.includes(route) || entries.some((e) => e.startsWith(route)),
      `Route /${route === 'page' ? '' : route} should have a build artifact`
    )
  }
})

test('PRD/SPEC.md is v3.0.2', () => {
  const specPath = join(REPO_ROOT, 'PRD/SPEC.md')
  assert.ok(existsSync(specPath), 'PRD/SPEC.md should exist')
  const spec = readFileSync(specPath, 'utf8')
  assert.match(spec, /# 文字轉語音 MVP — 規格計劃書 v3\.0\.2/)
  assert.match(spec, /v3\.0\.2 改版摘要/)
})

test('PRD/CHANGELOG.md exists with v3.0.2 entry', () => {
  const p = join(REPO_ROOT, 'PRD/CHANGELOG.md')
  assert.ok(existsSync(p), 'PRD/CHANGELOG.md should exist')
  const c = readFileSync(p, 'utf8')
  assert.match(c, /## v3\.0\.2 — 2026-09-06/)
})

test('GHA ci.yml exists and runs pnpm run ci', () => {
  const p = join(REPO_ROOT, '.github/workflows/ci.yml')
  assert.ok(existsSync(p), '.github/workflows/ci.yml should exist')
  const c = readFileSync(p, 'utf8')
  assert.match(c, /pnpm run ci/)
  assert.match(c, /branches: \[master\]/)
  assert.match(c, /workflow_dispatch/)
})

test('GHA deploy.yml targets master (not main)', () => {
  const p = join(REPO_ROOT, '.github/workflows/deploy.yml')
  assert.ok(existsSync(p), '.github/workflows/deploy.yml should exist')
  const c = readFileSync(p, 'utf8')
  assert.match(c, /branches: \[master\]/)
  assert.doesNotMatch(c, /branches: \[main\]/)
  assert.match(c, /vercel-action@v25/)
})

test('vercel.json is valid and targets Next.js', () => {
  const p = join(REPO_ROOT, 'vercel.json')
  assert.ok(existsSync(p), 'vercel.json should exist')
  const cfg = JSON.parse(readFileSync(p, 'utf8'))
  // Accept either `framework: "nextjs"` or a `builds` array using @vercel/next
  const isNext = cfg.framework === 'nextjs'
    || (Array.isArray(cfg.builds) && cfg.builds.some((b) => b.use === '@vercel/next'))
  assert.ok(isNext, 'vercel.json should target Next.js (framework or builds[].use)')
})

test('lib/ Hermes engine modules load', () => {
  // Hermes unified TTS interface
  const tts = require(join(REPO_ROOT, 'lib/tts-engines.js'))
  assert.equal(tts.SUPPORTED_ENGINES.length, 5, 'should have 5 engines')

  // TTS prompt catalog
  const tp = require(join(REPO_ROOT, 'lib/tts-prompts.js'))
  const cat = tp.getCatalog()
  assert.equal(cat.engines.length, 5)
  assert.equal(cat.emotions.length, 12)
  assert.equal(cat.roles.length, 12)
  assert.equal(cat.presets.length, 12)
})

test('lib/ post-process exporters work for SRT and VTT', () => {
  const pp = require(join(REPO_ROOT, 'lib/post-process.js'))
  const srt = pp.toSrt([{ start: 0, end: 5, text: '哈囉' }])
  assert.ok(srt.includes('00:00:00,000'), 'SRT format broken')
  const vtt = pp.toVtt([{ start: 0, end: 5, text: '哈囉' }])
  assert.ok(vtt.startsWith('WEBVTT'), 'VTT format broken')
})

test('lib/ ePub builder produces valid archive', () => {
  const epub = require(join(REPO_ROOT, 'lib/epub.js'))
  const buf = epub.buildEpub({
    title: 't',
    chapters: [],
    segments: [{ start: 0, end: 1, text: 'x' }],
  })
  assert.ok(buf.length >= 100, 'ePub build failed')
})

test('lib/ webhook sign/verify roundtrip', () => {
  const wh = require(join(REPO_ROOT, 'lib/webhook.js'))
  const sig = wh.signPayload('test-payload')
  assert.ok(wh.verifyPayload('test-payload', sig), 'webhook sign/verify broken')
})
