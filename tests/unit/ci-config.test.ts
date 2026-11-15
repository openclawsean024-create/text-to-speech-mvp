import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

describe('AC-001 CI 可重跑', () => {
  it('AC-001 pnpm-workspace.yaml 有非空的 packages 欄位（否則 pnpm 9 安裝失敗）', () => {
    const yaml = read('pnpm-workspace.yaml')
    const match = /^packages:\s*\n((?:[ \t]+-[ \t]+\S.*\n?)+)/m.exec(yaml)
    expect(match, 'packages 欄位缺少或為空').not.toBeNull()
    const entries = match![1].split('\n').map((l) => l.trim()).filter(Boolean)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries).toContain("- '.'")
  })

  it('AC-001 只保留 pnpm 一種 lockfile', () => {
    expect(existsSync(path.join(ROOT, 'pnpm-lock.yaml'))).toBe(true)
    for (const other of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'bun.lockb', 'bun.lock']) {
      expect(existsSync(path.join(ROOT, other)), `${other} 不應存在`).toBe(false)
    }
  })

  it('AC-001 pnpm run ci 依序串接 typecheck、lint、test、build、e2e，任一失敗即失敗', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    const stages = pkg.scripts.ci.split('&&').map((s) => s.trim())
    expect(stages).toEqual([
      'pnpm run typecheck',
      'pnpm run lint',
      'pnpm run test',
      'pnpm run build',
      'pnpm run e2e',
    ])
    // 不得用 `;`、`||` 或 `|| true` 吞掉失敗
    expect(pkg.scripts.ci).not.toMatch(/;|\|\|/)
    for (const name of ['typecheck', 'lint', 'test', 'build', 'e2e']) {
      expect(pkg.scripts[name], `缺少 script: ${name}`).toBeTruthy()
      expect(pkg.scripts[name]).not.toMatch(/\|\|\s*true|;\s*true|exit 0/)
    }
    expect(pkg.scripts.test).toBe('vitest run')
    expect(pkg.scripts.e2e).toContain('e2e/smoke.test.mjs')
  })

  it('AC-001 GHA ci workflow 以 frozen lockfile 安裝並執行 pnpm run ci，且不允許失敗被忽略', () => {
    const wf = read('.github/workflows/ci.yml')
    expect(wf).toMatch(/pnpm install --frozen-lockfile/)
    expect(wf).toMatch(/run: pnpm run ci/)
    expect(wf).not.toMatch(/continue-on-error:\s*true/)
    expect(wf).toMatch(/pull_request:/)
  })

  it('AC-001 測試在測試模式執行（Mock TTS、不連網）', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.TTS_PROVIDER).toBe('mock')
    expect(() => (globalThis.fetch as unknown as (u: string) => unknown)('https://example.invalid/')).toThrow(/不得連網/)
  })
})
