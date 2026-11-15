/**
 * 有聲書模組共用型別。
 * 移植自 ebook-to-audiobook `src/lib/engine/types.ts`（commit 75c3a31），SPEC §12.1 #1。
 */

export interface Chapter {
  number: number
  title: string
  text: string
  charCount: number
}

export interface ParsedBook {
  title: string
  author: string | null
  fileType: 'epub' | 'pdf' | 'txt'
  totalChars: number
  chapters: Chapter[]
  warnings: string[]
  /** True if the file is a scanned PDF needing OCR（未實作；M2 以後）。 */
  needsOcr: boolean
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * 朗讀者（旁白或角色）。M1 只有單一旁白；多角色偵測與配音（FR-010）屬 M2，
 * 屆時 ebook-to-audiobook 的 `Character` 型別可直接相容於此介面。
 */
export interface Speaker {
  id: string
  /** 顯示名稱，例如「旁白」。 */
  displayName: string
  isNarrator?: boolean
  voiceId?: string | null
  confidence?: number
}

export const NARRATOR: Speaker = { id: 'narrator', displayName: '旁白', isNarrator: true }
