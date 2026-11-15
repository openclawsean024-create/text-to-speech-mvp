import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseBookFile, BookFileError } from '@/lib/audiobook/extract'
import { parseEpub, xhtmlToText } from '@/lib/audiobook/epub-reader'
import { ZipArchive } from '@/lib/audiobook/zip-reader'
import { MAX_FILE_BYTES } from '@/lib/audiobook/types'
import { makeEpub, makePdf, makeZip } from '../helpers/zip'

const FIXTURE = readFileSync(path.resolve(__dirname, '../fixtures/sample-book.txt'))

async function rejection(input: Parameters<typeof parseBookFile>[0]): Promise<BookFileError> {
  try {
    await parseBookFile(input)
  } catch (err) {
    expect(err).toBeInstanceOf(BookFileError)
    return err as BookFileError
  }
  throw new Error('預期 parseBookFile 會拒絕這個檔案')
}

describe('AC-002 電子書解析（有聲書路徑）', () => {
  describe('TXT', () => {
    it('AC-002 自製 TXT fixture（3 個「第N章」）切出正確章數與標題', async () => {
      const book = await parseBookFile({ buffer: FIXTURE, filename: '巷口的一天.txt' })
      expect(book.fileType).toBe('txt')
      expect(book.title).toBe('巷口的一天')
      expect(book.chapters).toHaveLength(3)
      expect(book.chapters.map((c) => c.number)).toEqual([1, 2, 3])
      expect(book.chapters.map((c) => c.title)).toEqual([
        '第一章 巷口的豆漿店',
        '第二章 午後的雷陣雨',
        '第三章 夜市收攤以後',
      ])
      expect(book.chapters[0].text).toContain('阿嬤把磨好的黃豆倒進大鍋')
      expect(book.chapters[1].text).toContain('一把傘五十元')
      expect(book.chapters[2].text).toContain('便利商店的招牌還亮著')
      // 章節內文不含其他章的標題
      expect(book.chapters[0].text).not.toContain('第二章')
      expect(book.totalChars).toBe(book.chapters.reduce((sum, c) => sum + c.charCount, 0))
      expect(book.warnings).toEqual([])
    })

    it('AC-002 不套用 5,000 字截斷：超過 5,000 字的內容完整保留到最後一句', async () => {
      const filler = '這是一段自編的示範句子，用來把章節撐到很長。'
      const chapters = [1, 2, 3].map(
        (n) => `第${n}章 長篇示範\n${filler.repeat(200)}\n本章最後一句是編號${n}號結尾。`,
      )
      const text = chapters.join('\n\n')
      expect(text.length).toBeGreaterThan(12_000)

      const book = await parseBookFile({ buffer: Buffer.from(text, 'utf8'), filename: 'long.txt' })
      expect(book.chapters).toHaveLength(3)
      expect(book.totalChars).toBeGreaterThan(12_000)
      for (const chapter of book.chapters) {
        expect(chapter.charCount).toBeGreaterThan(4_000)
        expect(chapter.text.endsWith(`本章最後一句是編號${chapter.number}號結尾。`)).toBe(true)
      }
      // 原本 /api/extract-text 會把全文截成 5,000 字，第 2、3 章將完全消失
      expect(book.chapters[2].text).toContain('編號3號結尾')
    })

    it('AC-002 可使用自訂書名；含 BOM 的 UTF-8 與 Big5 編碼都能解析', async () => {
      const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('第一章 開頭\n內容一。\n第二章 結尾\n內容二。')])
      const book = await parseBookFile({ buffer: withBom, filename: 'a.txt', title: '  自訂書名  ' })
      expect(book.title).toBe('自訂書名')
      expect(book.chapters[0].title).toBe('第一章 開頭')

      // 「第一章」的 Big5 位元組 + ASCII 內文
      const big5 = Buffer.concat([Buffer.from([0xb2, 0xc4, 0xa4, 0x40, 0xb3, 0xb9]), Buffer.from('\nhello big5 text')])
      const big5Book = await parseBookFile({ buffer: big5, filename: 'big5.txt' })
      expect(big5Book.chapters[0].title).toBe('第一章')
      expect(big5Book.chapters[0].text).toBe('hello big5 text')
    })
  })

  describe('拒絕不合格的檔案', () => {
    it('AC-002 超過 50MB 的檔案被拒（413）', async () => {
      const big = Buffer.alloc(MAX_FILE_BYTES + 1, 0x61)
      const err = await rejection({ buffer: big, filename: 'huge.txt' })
      expect(err.status).toBe(413)
      expect(err.code).toBe('FILE_TOO_LARGE')
      expect(err.message).toMatch(/50 ?MB/i)
    })

    it('AC-002 剛好 50MB 不因大小被拒', async () => {
      const exact = Buffer.alloc(MAX_FILE_BYTES, 0x61)
      const book = await parseBookFile({ buffer: exact, filename: 'exact.txt' })
      expect(book.totalChars).toBe(MAX_FILE_BYTES)
    })

    it('AC-002 空檔案被拒（400）', async () => {
      const err = await rejection({ buffer: Buffer.alloc(0), filename: 'empty.txt' })
      expect(err.status).toBe(400)
      expect(err.code).toBe('EMPTY_FILE')
    })

    it('AC-002 副檔名為 .epub 但簽章錯誤的檔案被拒（415）', async () => {
      const err = await rejection({ buffer: Buffer.from('this is not a zip archive'), filename: 'fake.epub' })
      expect(err.status).toBe(415)
      expect(err.message).toMatch(/signature/i)
    })

    it('AC-002 副檔名為 .pdf 但簽章錯誤的檔案被拒（415）', async () => {
      const err = await rejection({ buffer: Buffer.from('<html>not a pdf</html>'), filename: 'fake.pdf' })
      expect(err.status).toBe(415)
      expect(err.message).toMatch(/signature/i)
    })

    it('AC-002 不支援的副檔名被拒（415）', async () => {
      const err = await rejection({ buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]), filename: 'setup.exe' })
      expect(err.status).toBe(415)
      expect(err.message).toMatch(/unsupported/i)
    })

    it('AC-002 ZIP 簽章但不是 EPUB（缺少 container.xml）被拒（415）', async () => {
      const zip = makeZip([{ name: 'word/document.xml', content: '<w:document/>' }])
      const err = await rejection({ buffer: zip, filename: 'renamed.epub' })
      expect(err.status).toBe(415)
      expect(err.message).toContain('container.xml')
    })

    it('AC-002 .txt 內含二進位資料被拒（415）', async () => {
      const err = await rejection({ buffer: Buffer.from([0x41, 0x00, 0x42, 0x00]), filename: 'binary.txt' })
      expect(err.status).toBe(415)
      expect(err.code).toBe('NOT_TEXT')
    })

    it('AC-002 只有空白的檔案被拒（422）', async () => {
      const err = await rejection({ buffer: Buffer.from('  \n\n  \t'), filename: 'blank.txt' })
      expect(err.status).toBe(422)
      expect(err.code).toBe('EMPTY_CONTENT')
    })
  })

  describe('EPUB（fixture 於測試中以自編內容即時產生）', () => {
    const chapters = [
      { title: '第一章 開店', paragraphs: ['清晨的蒸氣爬滿玻璃窗。', '第一位客人點了鹹豆漿 & 油條。'] },
      { title: '第二章 午後', paragraphs: ['雷陣雨來得又急又快。'] },
      { title: '第三章 收攤', paragraphs: ['最後一盞燈熄了。', '明天見。'] },
    ]

    it('AC-002 依 spine 順序切出章節，並讀出書名與作者', async () => {
      const epub = makeEpub({ title: '示範小書', author: '示範作者', chapters, withNav: true })
      const book = await parseBookFile({ buffer: epub, filename: 'demo.epub' })
      expect(book.fileType).toBe('epub')
      expect(book.title).toBe('示範小書')
      expect(book.author).toBe('示範作者')
      expect(book.chapters).toHaveLength(3)
      expect(book.chapters.map((c) => c.title)).toEqual(chapters.map((c) => c.title))
      // 標題不重複出現在內文；HTML 實體被還原；script 內容被移除
      expect(book.chapters[0].text).toBe('清晨的蒸氣爬滿玻璃窗。 第一位客人點了鹹豆漿 & 油條。')
      expect(book.chapters[2].text).toBe('最後一盞燈熄了。 明天見。')
      expect(JSON.stringify(book.chapters)).not.toContain('ignored()')
    })

    it('AC-002 單一內文文件的 EPUB 以章節標題切分；長內容不截斷', () => {
      const long = '自編長句用來測試不截斷。'.repeat(600)
      const epub = makeEpub({
        title: '單檔書',
        chapters: [{ title: '全文', paragraphs: ['第一章 上', long, '第二章 下', long, '結尾句。'] }],
      })
      const book = parseEpub(epub)
      expect(book.chapters).toHaveLength(2)
      expect(book.chapters.map((c) => c.title)).toEqual(['第一章 上', '第二章 下'])
      expect(book.totalChars).toBeGreaterThan(14_000)
      expect(book.chapters[1].text.endsWith('結尾句。')).toBe(true)
    })

    it('AC-002 受 DRM 保護（encryption.xml 非字型混淆）或加密項目的 EPUB 被拒', async () => {
      const drm = makeEpub({
        title: '加密書',
        chapters,
        extraFiles: [
          {
            name: 'META-INF/encryption.xml',
            content:
              '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>',
          },
        ],
      })
      const err = await rejection({ buffer: drm, filename: 'drm.epub' })
      expect(err.status).toBe(415)
      expect(err.code).toBe('DRM_PROTECTED')

      // 只有字型混淆不算 DRM
      const fontOnly = makeEpub({
        title: '字型混淆書',
        chapters,
        extraFiles: [
          {
            name: 'META-INF/encryption.xml',
            content:
              '<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/></EncryptedData></encryption>',
          },
        ],
      })
      expect((await parseBookFile({ buffer: fontOnly, filename: 'font.epub' })).chapters).toHaveLength(3)

      const encryptedEntry = makeZip([{ name: 'secret.txt', content: 'x', encrypted: true }])
      expect(() => new ZipArchive(encryptedEntry).read('secret.txt')).toThrow(/加密/)
    })

    it('AC-002 xhtmlToText 保留段落換行並移除 style／script', () => {
      const text = xhtmlToText('<html><head><style>p{}</style></head><body><p>甲</p><p>乙<br/>丙</p><script>x()</script></body></html>')
      expect(text).toBe('甲\n乙\n丙')
    })
  })

  describe('PDF（文字型；fixture 於測試中即時產生）', () => {
    it('AC-002 文字型 PDF 可擷取文字並依 Chapter 標題切分', async () => {
      const pdf = makePdf([
        'Chapter 1',
        'The soy milk shop opens before sunrise every single day.',
        'Chapter 2',
        'An afternoon thunderstorm sends everyone under the arcade.',
      ])
      const book = await parseBookFile({ buffer: pdf, filename: 'demo.pdf' })
      expect(book.fileType).toBe('pdf')
      expect(book.chapters).toHaveLength(2)
      expect(book.chapters[0].text).toContain('soy milk shop')
      expect(book.chapters[1].text).toContain('thunderstorm')
    })

    it('AC-002 損毀的 PDF 被拒（422）', async () => {
      const err = await rejection({ buffer: Buffer.from('%PDF-1.4\nthis is not really a pdf'), filename: 'broken.pdf' })
      expect(err.status).toBe(422)
    })
  })
})
