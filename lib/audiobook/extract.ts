/**
 * 上傳檔案 → ParsedBook（有聲書路徑的唯一入口）。
 *
 * 與 /api/extract-text 不同：這裡【不截斷】字數（GOAL AC-002），並先做大小上限與
 * 魔術位元組檢查。支援 TXT（UTF-8；無法以 UTF-8 解碼時嘗試 Big5）、EPUB、PDF（文字型）。
 */

import { detectFileType, parsePlainText, validateBookSize } from './parser'
import { parseEpub, DrmProtectedError } from './epub-reader'
import type { ParsedBook } from './types'

export class BookFileError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 422,
    readonly code: string,
  ) {
    super(message)
    this.name = 'BookFileError'
  }
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').trim()
  return base || 'Untitled'
}

function decodeText(buffer: Buffer): string {
  if (buffer.includes(0)) {
    throw new BookFileError('Unsupported file: 內容不是純文字（含二進位資料）', 415, 'NOT_TEXT')
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('big5', { fatal: true }).decode(buffer)
    } catch {
      throw new BookFileError('無法辨識文字編碼，請以 UTF-8 儲存後再上傳。', 415, 'BAD_ENCODING')
    }
  }
}

function parseTxtBook(buffer: Buffer, title: string): ParsedBook {
  const text = decodeText(buffer).replace(/^﻿/, '').trim()
  const chapters = parsePlainText(text, title)
  const warnings: string[] = []
  if (chapters.length === 0 || chapters[0].charCount === 0) {
    warnings.push('File appears to be empty or contains only whitespace.')
  }
  return {
    title,
    author: null,
    fileType: 'txt',
    totalChars: chapters.reduce((sum, c) => sum + c.charCount, 0),
    chapters,
    warnings,
    needsOcr: false,
  }
}

async function parsePdfBook(buffer: Buffer, title: string): Promise<ParsedBook> {
  // 直接載入 lib 進入點：套件的 index.js 在某些打包環境會誤入 debug 模式而讀取不存在的測試檔。
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (data: Uint8Array) => Promise<{ text: string; numpages: number }>
  let data: { text: string; numpages: number }
  try {
    // 複製到獨立的 ArrayBuffer：pdf.js 會直接讀取底層 ArrayBuffer，
    // 若傳入來自 Node 共用 pool 的小 Buffer（byteOffset ≠ 0）會讀到別的資料。
    data = await pdfParse(Uint8Array.from(buffer))
  } catch {
    throw new BookFileError('無法解析此 PDF，檔案可能損毀或受保護。', 422, 'PDF_PARSE_FAILED')
  }
  const text = (data.text || '').trim()
  const chapters = text ? parsePlainText(text, title) : []
  const warnings: string[] = []
  // 每頁平均不到 20 字 → 多半是掃描影像，需要 OCR（未支援）
  const needsOcr = data.numpages > 0 && text.replace(/\s+/g, '').length < data.numpages * 20
  if (needsOcr) warnings.push('PDF 幾乎沒有可擷取的文字，可能是掃描檔；目前不支援 OCR。')
  return {
    title,
    author: null,
    fileType: 'pdf',
    totalChars: chapters.reduce((sum, c) => sum + c.charCount, 0),
    chapters,
    warnings,
    needsOcr,
  }
}

export interface ParseBookInput {
  buffer: Buffer
  filename: string
  /** 使用者自訂書名；未提供時用 EPUB 中繼資料或檔名。 */
  title?: string
}

export async function parseBookFile(input: ParseBookInput): Promise<ParsedBook> {
  const { buffer, filename } = input
  const customTitle = input.title?.trim()

  try {
    validateBookSize(buffer.length)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid file size'
    throw new BookFileError(message, buffer.length === 0 ? 400 : 413, buffer.length === 0 ? 'EMPTY_FILE' : 'FILE_TOO_LARGE')
  }

  let fileType: 'epub' | 'pdf' | 'txt'
  try {
    fileType = detectFileType(buffer, filename)
  } catch (err) {
    throw new BookFileError(err instanceof Error ? err.message : 'Unsupported file', 415, 'UNSUPPORTED_FILE')
  }

  let book: ParsedBook
  if (fileType === 'txt') {
    book = parseTxtBook(buffer, customTitle || titleFromFilename(filename))
  } else if (fileType === 'pdf') {
    book = await parsePdfBook(buffer, customTitle || titleFromFilename(filename))
  } else {
    try {
      book = parseEpub(buffer, titleFromFilename(filename))
    } catch (err) {
      if (err instanceof DrmProtectedError) throw new BookFileError(err.message, 415, 'DRM_PROTECTED')
      throw new BookFileError(err instanceof Error ? err.message : 'Unsupported file', 415, 'UNSUPPORTED_FILE')
    }
    if (customTitle) book = { ...book, title: customTitle }
  }

  if (book.needsOcr) {
    throw new BookFileError(book.warnings[book.warnings.length - 1] ?? '需要 OCR', 422, 'NEEDS_OCR')
  }
  if (book.chapters.length === 0 || book.totalChars === 0) {
    throw new BookFileError('檔案沒有可朗讀的文字內容。', 422, 'EMPTY_CONTENT')
  }
  return book
}
