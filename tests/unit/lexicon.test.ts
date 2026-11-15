import { describe, it, expect } from 'vitest'
import {
  applyLexicon,
  mergeEntries,
  normalizeEntry,
  getSystemEntries,
  upsertUserEntries,
  getUserEntries,
  removeUserEntry,
  getEffectiveEntries,
  LEXICON_KEY_PREFIX,
  LexiconValidationError,
  type LexiconEntry,
} from '@/lib/lexicon'
import { toWhisperPrompt, setGlossary, getGlossary } from '@/lib/glossary'
import { getStore } from '@/lib/kv-store'
import { uniqueUser } from '../helpers/http'

// 全部為自編示範詞條
const e = (term: string, replacement: string): LexiconEntry => ({ term, replacement })

describe('AC-006 繁中發音校正詞庫：套用規則', () => {
  it('AC-006 最長匹配優先', () => {
    const entries = [e('銀行', '銀航'), e('銀行行長', '銀航航掌'), e('行長', '航掌')]
    expect(applyLexicon('銀行行長來了', entries).text).toBe('銀航航掌來了')
    expect(applyLexicon('銀行很大', entries).text).toBe('銀航很大')
  })

  it('AC-006 同句多詞條都會套用', () => {
    const entries = [e('重新', '蟲新'), e('長大', '掌大'), e('TTS', 'T T S')]
    const result = applyLexicon('孩子長大後重新學 TTS。', entries)
    expect(result.text).toBe('孩子掌大後蟲新學 T T S。')
    expect(result.replacements.map((r) => r.term)).toEqual(['長大', '重新', 'TTS'])
  })

  it('AC-006 不重疊替換：由左至右，已替換的區段不再被其他詞條命中', () => {
    // 「行長大」：「行長」先命中，剩下的「大」不會再與「長大」重疊
    const entries = [e('行長', '航掌'), e('長大', '掌大')]
    const result = applyLexicon('行長大方', entries)
    expect(result.text).toBe('航掌大方')
    expect(result.replacements).toEqual([{ index: 0, term: '行長', replacement: '航掌' }])
  })

  it('AC-006 替換後的文字不會被再次替換（無連鎖）', () => {
    const entries = [e('甲', '乙'), e('乙', '丙')]
    expect(applyLexicon('甲乙', entries).text).toBe('乙丙')
  })

  it('AC-006 沒有詞條或空字串時原樣回傳', () => {
    expect(applyLexicon('原文', []).text).toBe('原文')
    expect(applyLexicon('', [e('原', '圓')]).text).toBe('')
  })

  it('AC-006 使用者詞條覆蓋系統詞條（同原詞）', () => {
    const merged = mergeEntries([e('行長', '航掌'), e('重新', '蟲新')], [e('行長', '行(ㄏㄤˊ)長')])
    expect(merged.find((m) => m.term === '行長')).toMatchObject({ replacement: '行(ㄏㄤˊ)長', source: 'user' })
    expect(merged.find((m) => m.term === '重新')).toMatchObject({ source: 'system' })
    expect(applyLexicon('行長重新開會', merged).text).toBe('行(ㄏㄤˊ)長蟲新開會')
  })

  it('AC-006 系統預設詞條可載入且格式正確（含可選拼音／注音）', () => {
    const system = getSystemEntries()
    expect(system.length).toBeGreaterThan(0)
    expect(system.find((x) => x.term === '行長')).toMatchObject({ pinyin: 'hang2 zhang3', zhuyin: 'ㄏㄤˊ ㄓㄤˇ' })
  })

  it('AC-006 詞條驗證：缺欄位、過長、含 SSML 特殊字元、拼音／注音格式錯誤都拒絕', () => {
    expect(() => normalizeEntry({ term: '', replacement: 'x' })).toThrow(LexiconValidationError)
    expect(() => normalizeEntry({ term: '甲' })).toThrow(/replacement/)
    expect(() => normalizeEntry({ term: '甲'.repeat(51), replacement: 'x' })).toThrow(/最多/)
    expect(() => normalizeEntry({ term: '<b>', replacement: 'x' })).toThrow(/< > &/)
    expect(() => normalizeEntry({ term: '甲', replacement: '乙', pinyin: '甲乙' })).toThrow(/拼音/)
    expect(() => normalizeEntry({ term: '甲', replacement: '乙', zhuyin: 'abc' })).toThrow(/注音/)
    expect(normalizeEntry({ term: ' 甲 ', replacement: ' 乙 ', zhuyin: 'ㄧˇ' })).toEqual({ term: '甲', replacement: '乙', zhuyin: 'ㄧˇ' })
  })
})

describe('AC-006 使用者詞庫儲存', () => {
  it('AC-006 新增、覆蓋、刪除；超過上限整筆拒絕', async () => {
    const userId = uniqueUser('lex')
    await upsertUserEntries(userId, [e('示範詞', '是範詞'), e('甲', '乙')], 3)
    await upsertUserEntries(userId, [e('甲', '丙')], 3)
    expect(await getUserEntries(userId)).toEqual([e('示範詞', '是範詞'), e('甲', '丙')])

    await expect(upsertUserEntries(userId, [e('一', '1'), e('二', '2')], 3)).rejects.toThrow(/上限/)
    expect(await getUserEntries(userId)).toHaveLength(2)

    expect(await removeUserEntry(userId, '甲')).toBe(true)
    expect(await removeUserEntry(userId, '甲')).toBe(false)
    expect((await getEffectiveEntries(userId)).some((x) => x.term === '示範詞' && x.source === 'user')).toBe(true)
  })

  it('AC-006 不與 Whisper 逐字稿詞彙表混用：資料分開存放、彼此不影響', async () => {
    const userId = uniqueUser('lex')
    await setGlossary(userId, ['只給逐字稿用的詞'], 'free')
    await upsertUserEntries(userId, [e('只給語音用的詞', '只給語音用的辭')], 10)

    // 詞庫不含詞彙表內容
    const effective = await getEffectiveEntries(userId)
    expect(effective.some((x) => x.term === '只給逐字稿用的詞')).toBe(false)
    // 詞彙表不含詞庫內容
    const glossary = await getGlossary(userId, 'free')
    expect(glossary.words).toEqual(['只給逐字稿用的詞'])
    expect(toWhisperPrompt(glossary)).not.toContain('只給語音用的詞')
    // 儲存鍵不同
    expect(LEXICON_KEY_PREFIX).toBe('lexicon:')
    expect(await getStore().get(`${LEXICON_KEY_PREFIX}${userId}`)).toEqual([e('只給語音用的詞', '只給語音用的辭')])
  })
})
