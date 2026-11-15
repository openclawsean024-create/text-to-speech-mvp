/**
 * 測試用的最小 ZIP／EPUB／PDF 產生器：fixture 全在記憶體中組成，repo 不放任何電子書檔。
 */
import zlib from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipFile {
  name: string
  content: string | Buffer
  /** true＝deflate；false＝stored。 */
  deflate?: boolean
  /** 設定加密旗標（用來測試拒絕加密檔）。 */
  encrypted?: boolean
}

export function makeZip(files: ZipFile[]): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const raw = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8')
    const data = f.deflate ? zlib.deflateRawSync(raw) : raw
    const method = f.deflate ? 8 : 0
    const flags = f.encrypted ? 1 : 0
    const crc = crc32(raw)

    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    name.copy(local, 30)
    parts.push(local, data)

    const cd = Buffer.alloc(46 + name.length)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(flags, 8)
    cd.writeUInt16LE(method, 10)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(raw.length, 24)
    cd.writeUInt16LE(name.length, 28)
    cd.writeUInt32LE(offset, 42)
    name.copy(cd, 46)
    central.push(cd)

    offset += local.length + data.length
  }
  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, eocd])
}

export interface EpubChapterInput {
  title: string
  paragraphs: string[]
}

export interface EpubOptions {
  title: string
  author?: string
  chapters: EpubChapterInput[]
  /** 額外加入的檔案（例如 META-INF/encryption.xml）。 */
  extraFiles?: ZipFile[]
  /** 是否加入一個 nav 文件到 spine（應被解析器略過）。 */
  withNav?: boolean
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 以自編內容組出一本最小的 EPUB（章節檔採 deflate，其餘 stored）。 */
export function makeEpub(opts: EpubOptions): Buffer {
  const items = opts.chapters
    .map((_, i) => `<item id="c${i + 1}" href="text/ch%20${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ')
  const refs = opts.chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('\n    ')
  const nav = opts.withNav
    ? { item: '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', ref: '<itemref idref="nav"/>' }
    : { item: '', ref: '' }
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:00000000-0000-4000-8000-000000000001</dc:identifier>
    <dc:title>${esc(opts.title)}</dc:title>
    ${opts.author ? `<dc:creator>${esc(opts.author)}</dc:creator>` : ''}
    <dc:language>zh-TW</dc:language>
  </metadata>
  <manifest>
    ${nav.item}
    ${items}
  </manifest>
  <spine>
    ${nav.ref}
    ${refs}
  </spine>
</package>`
  const files: ZipFile[] = [
    { name: 'mimetype', content: 'application/epub+zip' },
    {
      name: 'META-INF/container.xml',
      content: `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    },
    { name: 'OEBPS/content.opf', content: opf },
  ]
  if (opts.withNav) {
    files.push({
      name: 'OEBPS/nav.xhtml',
      content: `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>目錄</title></head><body><nav><ol>${opts.chapters
        .map((c) => `<li>${esc(c.title)}</li>`)
        .join('')}</ol></nav></body></html>`,
    })
  }
  opts.chapters.forEach((c, i) => {
    files.push({
      name: `OEBPS/text/ch ${i + 1}.xhtml`,
      deflate: true,
      content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(c.title)}</title><style>p{margin:0}</style></head>
<body><h1>${esc(c.title)}</h1>${c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')}<script>ignored()</script></body></html>`,
    })
  })
  return makeZip([...files, ...(opts.extraFiles ?? [])])
}

/** 以 ASCII 文字行組出單頁、文字型的最小 PDF（Helvetica）。 */
export function makePdf(lines: string[]): Buffer {
  const escPdf = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const content = ['BT', '/F1 12 Tf', '72 720 Td', '16 TL', ...lines.map((l) => `(${escPdf(l)}) Tj T*`), 'ET'].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
