/**
 * ePub 2.0 generator — F-006
 *
 * Generates a minimal valid ePub containing:
 *   - cover/title
 *   - chapterized transcript
 *   - summary
 *   - metadata (DC)
 *
 * Output: Buffer (zip archive)
 *
 * Pure JS implementation (no native deps). Suitable for serverless.
 */

const zlib = require('node:zlib')

function nowIso() {
  return new Date().toISOString().split('.')[0] + 'Z'
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// CRC32 for ZIP
function makeCrcTable() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
}
const CRC_TABLE = makeCrcTable()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Create a minimal zip archive with given files.
 * Uses stored (no compression) — sufficient for text ePub.
 */
function makeZip(files) {
  // files: [{ name: string, content: Buffer }]
  const records = []
  const central = []
  let offset = 0

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const content = f.content
    const crc = crc32(content)
    const size = content.length

    // Local file header (signature 0x04034b50)
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)            // version
    local.writeUInt16LE(0, 6)             // flags
    local.writeUInt16LE(0, 8)             // method = stored
    local.writeUInt16LE(0, 10)            // mod time
    local.writeUInt16LE(0, 12)            // mod date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(size, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    nameBuf.copy(local, 30)

    records.push(local, content)

    // Central directory record (signature 0x02014b50)
    const cd = Buffer.alloc(46 + nameBuf.length)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt16LE(0, 12)
    cd.writeUInt16LE(0, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(size, 20)
    cd.writeUInt32LE(size, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(0, 30)
    cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(offset, 42)
    nameBuf.copy(cd, 46)
    central.push(cd)

    offset += local.length + size
  }

  const centralStart = offset
  let centralSize = 0
  for (const c of central) centralSize += c.length
  const centralBuf = Buffer.concat(central)

  // End of central directory (signature 0x06054b50)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(centralStart, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...records, centralBuf, eocd])
}

/**
 * Build an ePub 2.0 archive from a podcast transcript + chapters + summary.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.author
 * @param {string} params.language    'zh-TW' etc.
 * @param {string} params.filename
 * @param {Array}  params.chapters    [{ title, startSec, endSec, key_points }]
 * @param {Array}  params.segments    [{ start, end, text }]
 * @param {Object} [params.summary]   { short, detailed, bullets }
 * @returns {Buffer} zip bytes
 */
function buildEpub(params) {
  const {
    title = 'Podcast Transcript',
    author = 'Hermes TTS',
    language = 'zh-TW',
    filename = 'podcast',
    chapters = [],
    segments = [],
    summary = null,
  } = params

  const id = `urn:hermes-tts:${Date.now()}`
  const now = nowIso()

  // ── mimetype (must be first, uncompressed) ─────────────────
  const mimetypeBuf = Buffer.from('application/epub+zip', 'utf8')

  // ── container.xml ──────────────────────────────────────────
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

  // ── content.opf (package metadata + manifest) ──────────────
  const manifestItems = [
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="summary" href="summary.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="chapters" href="chapters.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="transcript" href="transcript.xhtml" media-type="application/xhtml+xml"/>',
  ]
  // Add chapter items dynamically
  const chapterItems = chapters.map((c, i) =>
    `<item id="chap-${i}" href="chap-${i}.xhtml" media-type="application/xhtml+xml"/>`,
  ).join('\n    ')

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:identifier id="BookId">${escapeXml(id)}</dc:identifier>
    <dc:date>${now}</dc:date>
    <dc:publisher>Hermes TTS — Podcast 後製工廠</dc:publisher>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
    ${chapterItems}
  </manifest>
  <spine toc="ncx">
    <itemref idref="cover"/>
    <itemref idref="summary"/>
    <itemref idref="chapters"/>
    ${chapters.map((_, i) => `<itemref idref="chap-${i}"/>`).join('\n    ')}
    <itemref idref="transcript"/>
  </spine>
</package>`

  // ── toc.ncx (navigation) ───────────────────────────────────
  const navPoints = chapters.map((c, i) => {
    const offsetSec = Math.floor(c.startSec || 0)
    const m = Math.floor(offsetSec / 60)
    const s = offsetSec % 60
    return `<navPoint id="nav-${i}" playOrder="${i + 3}">
      <navLabel><text>${escapeXml(c.title)} (${m}:${String(s).padStart(2, '0')})</text></navLabel>
      <content src="chap-${i}.xhtml"/>
    </navPoint>`
  }).join('\n    ')

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(id)}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
    <navPoint id="nav-cover" playOrder="1">
      <navLabel><text>封面</text></navLabel>
      <content src="cover.xhtml"/>
    </navPoint>
    <navPoint id="nav-summary" playOrder="2">
      <navLabel><text>摘要</text></navLabel>
      <content src="summary.xhtml"/>
    </navPoint>
    ${navPoints}
    <navPoint id="nav-transcript" playOrder="${chapters.length + 3}">
      <navLabel><text>完整逐字稿</text></navLabel>
      <content src="transcript.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`

  // ── cover.xhtml ────────────────────────────────────────────
  const coverXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title></head>
<body style="font-family: sans-serif; padding: 2em;">
  <h1 style="font-size: 2em; margin-bottom: 0.5em;">${escapeXml(title)}</h1>
  <p style="color: #666;">作者：${escapeXml(author)}</p>
  <p style="color: #999; font-size: 0.9em;">由 Hermes TTS 後製工廠於 ${now} 產生</p>
</body>
</html>`

  // ── summary.xhtml ──────────────────────────────────────────
  const summaryBullets = (summary?.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('\n  ')
  const summaryXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>摘要 — ${escapeXml(title)}</title></head>
<body style="font-family: sans-serif; padding: 1em; line-height: 1.6;">
  <h1>摘要</h1>
  ${summary?.short ? `<h2>一句話摘要</h2><p>${escapeHtml(summary.short)}</p>` : ''}
  ${summary?.detailed ? `<h2>詳細摘要</h2><p>${escapeHtml(summary.detailed)}</p>` : ''}
  ${summaryBullets ? `<h2>重點整理</h2><ul>${summaryBullets}</ul>` : ''}
</body>
</html>`

  // ── chapters.xhtml (TOC) ───────────────────────────────────
  const chapterList = chapters.map((c, i) => {
    const offsetSec = Math.floor(c.startSec || 0)
    const m = Math.floor(offsetSec / 60)
    const s = offsetSec % 60
    return `<li><a href="chap-${i}.xhtml">${escapeHtml(c.title)}</a> — ${m}:${String(s).padStart(2, '0')}</li>`
  }).join('\n  ')
  const chaptersXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>章節 — ${escapeXml(title)}</title></head>
<body style="font-family: sans-serif; padding: 1em;">
  <h1>章節</h1>
  <ul>${chapterList}</ul>
</body>
</html>`

  // ── per-chapter xhtml ──────────────────────────────────────
  const chapterFiles = chapters.map((c, i) => {
    const segsInChapter = segments.filter((s) => s.start >= (c.startSec || 0) && s.start < (c.endSec || Infinity))
    const paras = segsInChapter.map((s) => `<p>${escapeHtml((s.text || '').trim())}</p>`).join('\n  ')
    const keyPoints = (c.key_points || []).map((kp) => `<li>${escapeHtml(kp)}</li>`).join('\n  ')
    return {
      name: `chap-${i}.xhtml`,
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(c.title)}</title></head>
<body style="font-family: serif; padding: 1em; line-height: 1.6;">
  <h1>${escapeXml(c.title)}</h1>
  ${keyPoints ? `<h2>重點</h2><ul>${keyPoints}</ul>` : ''}
  <h2>逐字稿</h2>
  ${paras}
</body>
</html>`, 'utf8'),
    }
  })

  // ── transcript.xhtml (full) ─────────────────────────────────
  const allParas = segments.map((s) => `<p>${escapeHtml((s.text || '').trim())}</p>`).join('\n  ')
  const transcriptXhtml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>完整逐字稿 — ${escapeXml(title)}</title></head>
<body style="font-family: serif; padding: 1em; line-height: 1.6;">
  <h1>完整逐字稿</h1>
  ${allParas}
</body>
</html>`, 'utf8')

  // ── assemble ZIP ────────────────────────────────────────────
  // mimetype must be the first entry, stored uncompressed
  const otherFiles = [
    { name: 'META-INF/container.xml', content: Buffer.from(containerXml, 'utf8') },
    { name: 'OEBPS/content.opf', content: Buffer.from(contentOpf, 'utf8') },
    { name: 'OEBPS/toc.ncx', content: Buffer.from(tocNcx, 'utf8') },
    { name: 'OEBPS/cover.xhtml', content: Buffer.from(coverXhtml, 'utf8') },
    { name: 'OEBPS/summary.xhtml', content: Buffer.from(summaryXhtml, 'utf8') },
    { name: 'OEBPS/chapters.xhtml', content: Buffer.from(chaptersXhtml, 'utf8') },
    ...chapterFiles.map((f) => ({ name: `OEBPS/${f.name}`, content: f.content })),
    { name: 'OEBPS/transcript.xhtml', content: transcriptXhtml },
  ]

  // Build zip manually — first entry mimetype must be stored & uncompressed
  const allFiles = [
    { name: 'mimetype', content: mimetypeBuf, _mimetype: true },
    ...otherFiles,
  ]

  // For ePub compatibility we cannot use deflate with our custom zip, so all entries are stored.
  const records = []
  const central = []
  let offset = 0

  for (const f of allFiles) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const content = f.content
    const crc = crc32(content)
    const size = content.length

    // Local file header
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)             // method = stored
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(size, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    nameBuf.copy(local, 30)

    records.push(local, content)

    // Central directory
    const cd = Buffer.alloc(46 + nameBuf.length)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt16LE(0, 12)
    cd.writeUInt16LE(0, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(size, 20)
    cd.writeUInt32LE(size, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(0, 30)
    cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(offset, 42)
    nameBuf.copy(cd, 46)
    central.push(cd)

    offset += local.length + size
  }

  const centralStart = offset
  const centralBuf = Buffer.concat(central)
  const centralSize = centralBuf.length

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(allFiles.length, 8)
  eocd.writeUInt16LE(allFiles.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(centralStart, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...records, centralBuf, eocd])
}

module.exports = {
  buildEpub,
}
