/**
 * 最小化的 ZIP 讀取器（只供 EPUB 解析使用；無第三方相依）。
 * 支援 stored（0）與 deflate（8）；拒絕加密項目，並限制解壓後大小以防 zip bomb。
 */

import zlib from 'node:zlib'

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

/** 單一項目解壓後上限。 */
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024
/** 全部被讀取項目解壓後合計上限。 */
export const MAX_TOTAL_BYTES = 256 * 1024 * 1024

interface ZipEntry {
  name: string
  method: number
  flags: number
  compressedSize: number
  uncompressedSize: number
  localOffset: number
}

export class ZipArchive {
  private readonly entries = new Map<string, ZipEntry>()
  private totalRead = 0

  constructor(private readonly buffer: Buffer) {
    this.readCentralDirectory()
  }

  private readCentralDirectory(): void {
    const buf = this.buffer
    const minEocd = 22
    if (buf.length < minEocd) throw new Error('ZIP 結構無效：檔案過短')
    let eocd = -1
    const lowest = Math.max(0, buf.length - (minEocd + 0xffff))
    for (let i = buf.length - minEocd; i >= lowest; i--) {
      if (buf.readUInt32LE(i) === EOCD_SIG) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error('ZIP 結構無效：找不到中央目錄')

    const count = buf.readUInt16LE(eocd + 10)
    let offset = buf.readUInt32LE(eocd + 16)
    for (let i = 0; i < count; i++) {
      if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CENTRAL_SIG) {
        throw new Error('ZIP 結構無效：中央目錄損毀')
      }
      const flags = buf.readUInt16LE(offset + 8)
      const method = buf.readUInt16LE(offset + 10)
      const compressedSize = buf.readUInt32LE(offset + 20)
      const uncompressedSize = buf.readUInt32LE(offset + 24)
      const nameLen = buf.readUInt16LE(offset + 28)
      const extraLen = buf.readUInt16LE(offset + 30)
      const commentLen = buf.readUInt16LE(offset + 32)
      const localOffset = buf.readUInt32LE(offset + 42)
      const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')
      this.entries.set(name, { name, method, flags, compressedSize, uncompressedSize, localOffset })
      offset += 46 + nameLen + extraLen + commentLen
    }
  }

  names(): string[] {
    return [...this.entries.keys()]
  }

  has(name: string): boolean {
    return this.entries.has(name)
  }

  read(name: string): Buffer {
    const entry = this.entries.get(name)
    if (!entry) throw new Error(`ZIP 內找不到檔案：${name}`)
    if (entry.flags & 0x1) throw new Error('不接受加密的壓縮檔（可能受 DRM 保護）')
    if (entry.uncompressedSize > MAX_ENTRY_BYTES) throw new Error('壓縮檔內的檔案過大')

    const buf = this.buffer
    const lo = entry.localOffset
    if (lo + 30 > buf.length || buf.readUInt32LE(lo) !== LOCAL_SIG) {
      throw new Error('ZIP 結構無效：本地檔頭損毀')
    }
    const nameLen = buf.readUInt16LE(lo + 26)
    const extraLen = buf.readUInt16LE(lo + 28)
    const start = lo + 30 + nameLen + extraLen
    const end = start + entry.compressedSize
    if (end > buf.length) throw new Error('ZIP 結構無效：資料超出檔案範圍')
    const raw = buf.subarray(start, end)

    let out: Buffer
    if (entry.method === 0) out = Buffer.from(raw)
    else if (entry.method === 8) out = zlib.inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES })
    else throw new Error(`不支援的 ZIP 壓縮方式：${entry.method}`)

    this.totalRead += out.length
    if (this.totalRead > MAX_TOTAL_BYTES) throw new Error('壓縮檔解壓後內容過大')
    return out
  }

  readText(name: string): string {
    return this.read(name).toString('utf8')
  }
}
