#!/usr/bin/env node
/**
 * CI smoke test — runs as prebuild step in Vercel + locally.
 *
 * Verifies critical v3.0 modules load without runtime errors.
 * Mirrors the GitHub Actions CI workflow file in docs/CI.md.
 */

const tests = []

function test(name, fn) {
  tests.push({ name, fn })
}

test('TTS engines loaded (5 engines)', () => {
  const tts = require('../lib/tts-engines.js')
  if (tts.SUPPORTED_ENGINES.length !== 5) {
    throw new Error(`Expected 5 engines, got ${tts.SUPPORTED_ENGINES.length}`)
  }
})

test('post-process: SRT formatter', () => {
  const pp = require('../lib/post-process.js')
  const srt = pp.toSrt([{ start: 0, end: 5, text: '哈囉' }])
  if (!srt.includes('00:00:00,000')) throw new Error('SRT format broken')
})

test('post-process: VTT formatter', () => {
  const pp = require('../lib/post-process.js')
  const vtt = pp.toVtt([{ start: 0, end: 5, text: '哈囉' }])
  if (!vtt.startsWith('WEBVTT')) throw new Error('VTT format broken')
})

test('ePub builder produces valid archive', () => {
  const epub = require('../lib/epub.js')
  const buf = epub.buildEpub({
    title: 't',
    chapters: [],
    segments: [{ start: 0, end: 1, text: 'x' }],
  })
  if (buf.length < 100) throw new Error('ePub build failed')
})

test('webhook sign/verify roundtrip', () => {
  const wh = require('../lib/webhook.js')
  const sig = wh.signPayload('test-payload')
  if (!wh.verifyPayload('test-payload', sig)) {
    throw new Error('webhook sign/verify broken')
  }
})

test('NewebPay tiers config', () => {
  const np = require('../lib/newebpay.js')
  if (!np.NEWEBPAY_TIERS.personal) throw new Error('NewebPay tiers missing')
  if (!np.NEWEBPAY_TIERS.creator) throw new Error('creator tier missing')
  if (!np.NEWEBPAY_TIERS.business) throw new Error('business tier missing')
})

test('TTS prompt catalog: 5 engines, 12 emotions, 12 roles', () => {
  const tp = require('../lib/tts-prompts.js')
  const cat = tp.getCatalog()
  if (cat.engines.length !== 5) throw new Error('Expected 5 engines')
  if (cat.emotions.length !== 12) throw new Error('Expected 12 emotions')
  if (cat.roles.length !== 12) throw new Error('Expected 12 roles')
  if (cat.presets.length !== 12) throw new Error('Expected 12 presets')
})

test('tts-prompts: normalizeZhText', () => {
  const tp = require('../lib/tts-prompts.js')
  if (typeof tp.normalizeZhText !== 'function') {
    throw new Error('normalizeZhText not exported')
  }
})

let passed = 0
let failed = 0

console.log('\n=== CI Smoke Tests (v3.0) ===\n')
for (const { name, fn } of tests) {
  try {
    fn()
    console.log(`  \u2713 ${name}`)
    passed++
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`)
    failed++
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
