#!/usr/bin/env node
/**
 * 機密掃描（GOAL AC-009）。
 *
 * 與 GOAL.md 的 `git grep` 指令掃描相同的樣式，但樣式在這裡以片段組合，
 * 避免本檔自己被掃到。掃描對象：所有被 git 追蹤（或尚未忽略）的文字檔，排除鎖定檔。
 *
 * 用法：pnpm run scan:secrets   （有命中時 exit 1）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', '.vercel', 'coverage'])
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'tsconfig.tsbuildinfo'])

/** 與 GOAL AC-009 等價的樣式（以片段組合，不改變比對語意）。 */
export const SECRET_PATTERN = new RegExp(
  [
    'sk-(proj-)?[A-Za-z0-9_-]{24,}',
    'sk_' + 'live_',
    'AIza' + '[0-9A-Za-z_-]{30,}',
    'eyJhbGci' + 'Oi',
  ].join('|'),
)

export function listScannableFiles(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) listScannableFiles(full, out)
    else if (!SKIP_FILES.has(name)) out.push(full)
  }
  return out
}

function isBinary(buf) {
  const n = Math.min(buf.length, 8000)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true
  return false
}

export function scanSecrets(root = ROOT) {
  const hits = []
  for (const file of listScannableFiles(root)) {
    const buf = readFileSync(file)
    if (isBinary(buf)) continue
    const lines = buf.toString('utf8').split('\n')
    lines.forEach((line, i) => {
      if (SECRET_PATTERN.test(line)) {
        hits.push({ file: path.relative(root, file), line: i + 1 })
      }
    })
  }
  return hits
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hits = scanSecrets()
  if (hits.length > 0) {
    console.error('疑似憑證樣式（只列位置，不輸出內容）：')
    for (const h of hits) console.error(`  ${h.file}:${h.line}`)
    process.exit(1)
  }
  console.log('secret scan: 0 hits')
}
