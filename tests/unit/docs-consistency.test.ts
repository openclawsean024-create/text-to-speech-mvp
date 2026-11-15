import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { scanSecrets, listScannableFiles } from '../../scripts/secret-scan.mjs'

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

describe('AC-009 合併紀錄、文件一致與機密掃描', () => {
  it('AC-009 repo 內沒有憑證樣式字串（與 GOAL 的 git grep 樣式相同）', () => {
    expect(scanSecrets(ROOT)).toEqual([])
  })

  it('AC-009 掃描器確實能抓到憑證樣式（避免掃描器本身失效）', () => {
    const fake = ['sk_' + 'live_', 'AIza' + 'x'.repeat(32), 'eyJhbGci' + 'OiJIUzI1NiJ9', 'sk-' + 'A'.repeat(30)]
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SECRET_PATTERN } = require('../../scripts/secret-scan.mjs') as { SECRET_PATTERN: RegExp }
    for (const s of fake) expect(SECRET_PATTERN.test(s), s).toBe(true)
    expect(SECRET_PATTERN.test('sk-...')).toBe(false)
  })

  it('AC-009 repo 內沒有 .epub／.pdf 書籍檔（含 ebook-to-audiobook 的 test-book.epub）', () => {
    const files = (listScannableFiles(ROOT) as string[]).map((f) => path.relative(ROOT, f))
    expect(files.filter((f) => /\.(epub|pdf|mobi|azw3?)$/i.test(f))).toEqual([])
    expect(files.some((f) => f.includes('test-book'))).toBe(false)
  })

  it('AC-009 git 追蹤的檔案中沒有書籍檔', () => {
    let tracked: string[]
    try {
      tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
    } catch {
      return // 非 git 環境（例如解壓的原始碼包）略過；前一個案例已涵蓋工作目錄
    }
    expect(tracked.filter((f) => /\.(epub|pdf|mobi|azw3?)$/i.test(f))).toEqual([])
  })

  it('AC-009 SOP.md 列出的 pnpm 指令都存在於 package.json，且主要 script 都寫進 SOP', () => {
    const sop = read('SOP.md')
    const referenced = new Set([...sop.matchAll(/pnpm run ([\w:-]+)/g)].map((m) => m[1]))
    for (const name of referenced) expect(pkg.scripts[name], `SOP 提到 pnpm run ${name}`).toBeTruthy()
    for (const name of ['typecheck', 'lint', 'smoke', 'build', 'e2e', 'ci', 'scan:secrets']) {
      expect(referenced.has(name), `SOP 缺少 pnpm run ${name}`).toBe(true)
    }
    expect(sop).toContain('pnpm test')
    expect(sop).toContain(pkg.scripts.ci.replace(/pnpm run /g, '').split(' && ').join(' → '))
  })

  it('AC-009 STATUS.md：9 條 AC 都有狀態；合併清單 #1～#11 每列都標示狀態', () => {
    const status = read('STATUS.md')
    for (let i = 1; i <= 9; i++) {
      const row = status.split('\n').find((l) => l.startsWith(`| AC-00${i} |`))
      expect(row, `AC-00${i}`).toBeTruthy()
    }
    const lines = status.split('\n')
    const start = lines.findIndex((l) => l.startsWith('## 合併清單進度'))
    for (let n = 1; n <= 11; n++) {
      const row = lines.slice(start).find((l) => l.startsWith(`| ${n} |`))
      expect(row, `#${n}`).toBeTruthy()
      const state = row!.split('|')[4].trim()
      expect(state, `#${n} 狀態`).toMatch(/✅|未開始/)
    }
    expect(status).toContain('待 Sean 定案')
    expect(status).toMatch(/package-lock\.json/)
  })

  it('AC-009 README 已移除 SPEC §13 列出的不實描述', () => {
    const readme = read('README.md')
    for (const claim of ['預訓練 5000 句', '≤ 500MB', '唯一的 AI', 'NT$99', 'NT$299', 'NT$2,999']) {
      expect(readme, `README 不應包含「${claim}」`).not.toContain(claim)
    }
    // 詞彙表的用途必須寫清楚：只給 Whisper，不影響 TTS
    expect(readme).toMatch(/只用於 Whisper 逐字稿提示，不影響 TTS 發音/)
    expect(readme).toContain('只有目錄 API')
  })

  it('AC-009 CHANGELOG 有 M1 紀錄且保留 v3.0.2（e2e 會檢查）；更正 v3.0.2 的 CI 綠燈描述', () => {
    const changelog = read('PRD/CHANGELOG.md')
    expect(changelog).toMatch(/## Unreleased — M1/)
    for (let i = 1; i <= 8; i++) expect(changelog).toContain(`AC-00${i}`)
    expect(changelog).toMatch(/## v3\.0\.2 — 2026-09-06/)
    expect(changelog).toContain('packages field missing or empty')
  })

  it('AC-009 程式與設定檔中沒有寫死的方案價格', () => {
    const plans = JSON.parse(read('config/plans.json')) as { plans: Array<{ price: unknown }> }
    expect(plans.plans.every((p) => p.price === null)).toBe(true)
    for (const file of ['lib/newebpay.js', 'lib/api-keys.ts', 'app/pricing/page.tsx', 'app/dashboard/page.tsx', 'app/page.tsx']) {
      expect(read(file), file).not.toMatch(/NT\$\s?[\d,]+/)
    }
    expect(read('lib/newebpay.js')).not.toMatch(/amount:\s*\d+/)
  })
})
