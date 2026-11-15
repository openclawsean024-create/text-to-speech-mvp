/**
 * EPUB → 章節（有聲書路徑專用；不截斷字數）。
 *
 * 依 OPF spine 順序讀取 XHTML，每個有內文的 spine 文件為一章；若整本只有一個內文文件，
 * 改用 parsePlainText 以「第N章／Chapter N」標題切分。
 *
 * 不處理 DRM：偵測到加密項目或 DRM 權利檔時直接拒絕（SPEC §8.2）。
 */

import path from 'node:path'
import { ZipArchive } from './zip-reader'
import { parsePlainText, sanitizeChapterText } from './parser'
import type { Chapter, ParsedBook } from './types'

/** 只做字型混淆（非 DRM）的加密演算法；其餘一律視為 DRM。 */
const FONT_OBFUSCATION_ALGORITHMS = ['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']

export class DrmProtectedError extends Error {
  constructor() {
    super('此 EPUB 疑似受 DRM 保護，無法處理。本服務不提供 DRM 移除，請上傳您擁有且未加密的檔案。')
    this.name = 'DrmProtectedError'
  }
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? (m[2] ?? m[3] ?? '') : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&apos;/g, "'")
}

function firstTagText(xml: string, tagPattern: string): string | null {
  const m = new RegExp(`<(?:${tagPattern})\\b[^>]*>([\\s\\S]*?)</(?:${tagPattern})>`, 'i').exec(xml)
  if (!m) return null
  const text = sanitizeChapterText(decodeEntities(m[1])).replace(/\s+/g, ' ').trim()
  return text || null
}

/** XHTML → 純文字，區塊元素之間保留換行。 */
export function xhtmlToText(xhtml: string): string {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(xhtml)?.[1] ?? xhtml
  const withBreaks = body
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article|tr)>/gi, '\n')
  return decodeEntities(withBreaks)
    .split('\n')
    .map((line) => sanitizeChapterText(line))
    .filter((line) => line.length > 0)
    .join('\n')
}

function assertNoDrm(zip: ZipArchive): void {
  if (zip.has('META-INF/rights.xml')) throw new DrmProtectedError()
  if (zip.has('META-INF/encryption.xml')) {
    const xml = zip.readText('META-INF/encryption.xml')
    const algorithms = [...xml.matchAll(/<(?:\w+:)?EncryptionMethod\b[^>]*>/gi)].map((m) => attr(m[0], 'Algorithm') ?? '')
    const onlyFonts = algorithms.length > 0 && algorithms.every((a) => FONT_OBFUSCATION_ALGORITHMS.includes(a))
    if (!onlyFonts) throw new DrmProtectedError()
  }
}

export function parseEpub(buffer: Buffer, fallbackTitle = 'Untitled'): ParsedBook {
  const zip = new ZipArchive(buffer)
  if (!zip.has('META-INF/container.xml')) {
    throw new Error('Unsupported file: 不是有效的 EPUB（缺少 META-INF/container.xml）')
  }
  assertNoDrm(zip)

  const container = zip.readText('META-INF/container.xml')
  const rootfileTag = /<rootfile\b[^>]*>/i.exec(container)?.[0]
  const opfPath = rootfileTag ? attr(rootfileTag, 'full-path') : null
  if (!opfPath || !zip.has(opfPath)) throw new Error('Unsupported file: EPUB 缺少 OPF 套件檔')

  const opf = zip.readText(opfPath)
  const opfDir = path.posix.dirname(opfPath)
  const title = firstTagText(opf, 'dc:title') || fallbackTitle
  const author = firstTagText(opf, 'dc:creator')

  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>()
  for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = attr(m[0], 'id')
    const href = attr(m[0], 'href')
    if (!id || !href) continue
    manifest.set(id, {
      href,
      mediaType: attr(m[0], 'media-type') ?? '',
      properties: attr(m[0], 'properties') ?? '',
    })
  }

  const warnings: string[] = []
  const docs: Array<{ title: string | null; text: string }> = []
  for (const m of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const idref = attr(m[0], 'idref')
    const item = idref ? manifest.get(idref) : undefined
    if (!item) continue
    if (!/x?html/i.test(item.mediaType)) continue
    if (/\bnav\b/.test(item.properties)) continue
    const rel = decodeURIComponent(item.href.split('#')[0])
    const full = opfDir === '.' ? rel : path.posix.normalize(`${opfDir}/${rel}`)
    if (!zip.has(full)) {
      warnings.push(`EPUB 內缺少 spine 文件：${rel}`)
      continue
    }
    const xhtml = zip.readText(full)
    const text = xhtmlToText(xhtml)
    if (!text) continue
    docs.push({ title: firstTagText(xhtml, 'h1|h2|h3') ?? firstTagText(xhtml, 'title'), text })
  }

  // 文件標題若同時是內文第一行，從內文移除以免重複朗讀
  const bodyLines = (doc: { title: string | null; text: string }): string[] => {
    const lines = doc.text.split('\n')
    if (doc.title && lines.length > 1 && lines[0].replace(/\s+/g, ' ').trim() === doc.title) lines.shift()
    return lines
  }

  let chapters: Chapter[]
  if (docs.length === 1) {
    chapters = parsePlainText(bodyLines(docs[0]).join('\n'), title)
  } else {
    chapters = docs.map((doc, i) => {
      const body = bodyLines(doc).join(' ').replace(/\s+/g, ' ').trim()
      return { number: i + 1, title: doc.title ?? `Chapter ${i + 1}`, text: body, charCount: body.length }
    })
  }
  if (chapters.length === 0) warnings.push('EPUB 沒有可朗讀的文字內容。')

  return {
    title,
    author,
    fileType: 'epub',
    totalChars: chapters.reduce((sum, c) => sum + c.charCount, 0),
    chapters,
    warnings,
    needsOcr: false,
  }
}
