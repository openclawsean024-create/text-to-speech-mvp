import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildShareUrl, parseSharedSettings, hasLegacyContentParam } from '@/lib/share'

const SECRET_TEXT = '這是使用者輸入的未公開講稿，內含聯絡方式 test@example.com'

describe('AC-007 分享連結不得把原文放進 URL', () => {
  it('AC-007 buildShareUrl 只輸出白名單設定參數', () => {
    const url = new URL(buildShareUrl('https://app.example.test', { engine: 'azure', voice: 'zh-TW', speed: 1.25 }))
    expect([...url.searchParams.keys()].sort()).toEqual(['engine', 'shared', 'speed', 'voice'])
    expect(url.searchParams.get('shared')).toBe('1')
    expect(url.searchParams.get('engine')).toBe('azure')
    expect(url.searchParams.get('voice')).toBe('zh-TW')
    expect(url.searchParams.get('speed')).toBe('1.25')
  })

  it('AC-007 即使把原文塞進設定欄位也不會出現在 URL', () => {
    const url = buildShareUrl('https://app.example.test', {
      engine: SECRET_TEXT,
      voice: SECRET_TEXT,
      speed: Number.NaN,
      // 多餘欄位（例如舊版的 text）一律被忽略
      ...({ text: SECRET_TEXT } as object),
    } as never)
    expect(url).toBe('https://app.example.test/?shared=1')
    expect(decodeURIComponent(url)).not.toContain('講稿')
    expect(decodeURIComponent(url)).not.toContain('test@example.com')
  })

  it('AC-007 parseSharedSettings 忽略 text 等非白名單參數', () => {
    const parsed = parseSharedSettings(`?shared=1&engine=google&voice=zh-TW-male&speed=1.5&text=${encodeURIComponent(SECRET_TEXT)}`)
    expect(parsed).toEqual({ engine: 'google', voice: 'zh-TW-male', speed: 1.5 })
    expect(JSON.stringify(parsed)).not.toContain('講稿')
    expect(parseSharedSettings('?engine=google')).toBeNull()
    expect(parseSharedSettings('?shared=1&engine=evil&speed=99')).toEqual({})
  })

  it('AC-007 舊版連結的 text 參數會被偵測（頁面載入時自網址列移除）', () => {
    expect(hasLegacyContentParam('?shared=1&text=abc')).toBe(true)
    expect(hasLegacyContentParam('?shared=1&engine=openai')).toBe(false)
  })

  it('AC-007 首頁分享功能使用 buildShareUrl，且不再自行組出含 text 的查詢字串', () => {
    const page = readFileSync(path.resolve(__dirname, '../../app/page.tsx'), 'utf8')
    const start = page.indexOf('const handleShare')
    expect(start).toBeGreaterThan(-1)
    const handler = page.slice(start, page.indexOf('const ENGINES', start))
    expect(handler).toContain('buildShareUrl(')
    expect(handler).not.toMatch(/text\s*:/)
    expect(handler).not.toContain('URLSearchParams')
  })
})
