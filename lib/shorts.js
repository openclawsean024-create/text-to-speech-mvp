/**
 * YouTube Shorts / Reels / TikTok 9:16 video generator — F-009 副產品
 *
 * Takes an MP3/WAV audio buffer + title + subtitle text → produces a 9:16 vertical MP4
 * suitable for direct upload to YouTube Shorts, IG Reels, TikTok.
 *
 * Uses ffmpeg with:
 *   - 1080x1920 canvas (9:16)
 *   - Centered title + scrolling caption
 *   - Audio track from input
 *   - Background gradient (or solid color)
 *
 * Pure-JS orchestrator — relies on ffmpeg binary (already in PATH for existing WAV conversion).
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const SHORTS_RESOLUTIONS = {
  '1080x1920': { width: 1080, height: 1920 },  // YouTube Shorts, TikTok
  '1080x1350': { width: 1080, height: 1350 },  // IG Reels 4:5 fallback
  '720x1280':  { width: 720,  height: 1280 },   // Smaller, faster export
}

const FONTS = {
  // ffmpeg drawtext font paths — defaults to Noto Sans CJK if available
  'noto-cjk': '/System/Library/Fonts/PingFang.ttc',
  'system':    'Arial',
}

/**
 * Escape text for ffmpeg drawtext filter.
 */
function escapeFfmpegText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\n/g, '\\n')
}

/**
 * Build a 9:16 vertical short video from audio + text.
 *
 * @param {Object} params
 * @param {Buffer} params.audio          MP3 or WAV bytes
 * @param {string} [params.mimeType]     'audio/mpeg' | 'audio/wav'
 * @param {string} params.title          Headline shown on screen
 * @param {string} [params.subtitle]     Body text (multi-line supported)
 * @param {string} [params.bgColor]      Hex background color (e.g., '0x1a1a2e')
 * @param {string} [params.fgColor]      Hex text color (e.g., 'white')
 * @param {string} [params.aspect]       '9:16' (default), '4:5', '1:1'
 * @returns {Promise<Buffer>} MP4 video bytes
 */
async function buildShort({ audio, mimeType = 'audio/mpeg', title, subtitle, bgColor = '0x1a1a2e', fgColor = 'white', aspect = '9:16' }) {
  if (!audio || !Buffer.isBuffer(audio)) {
    throw new Error('audio Buffer is required')
  }
  if (!title) throw new Error('title is required')

  const resolution = aspect === '4:5'
    ? SHORTS_RESOLUTIONS['1080x1350']
    : aspect === '1:1'
      ? { width: 1080, height: 1080 }
      : SHORTS_RESOLUTIONS['1080x1920']

  const tmpDir = os.tmpdir()
  const audioFile = path.join(tmpDir, `shorts-audio-${Date.now()}.${mimeType.includes('wav') ? 'wav' : 'mp3'}`)
  const videoFile = path.join(tmpDir, `shorts-${Date.now()}.mp4`)
  const fontFile = findFontFile()

  fs.writeFileSync(audioFile, audio)

  try {
    // Get audio duration via ffprobe
    let duration = 30 // default
    try {
      const probeOutput = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`,
        { encoding: 'utf8' },
      ).trim()
      duration = Math.max(5, Math.min(60, parseFloat(probeOutput) || 30))
    } catch {
      duration = 30
    }

    // Escape text
    const titleEsc = escapeFfmpegText(title.slice(0, 60))
    const subtitleEsc = subtitle ? escapeFfmpegText(subtitle.slice(0, 200)) : ''

    // Build drawtext filter (title + subtitle)
    const fontArg = fontFile ? `:fontfile=${fontFile}` : ''
    const titleFilter = `drawtext=text='${titleEsc}'${fontArg}:fontcolor=${fgColor}:fontsize=72:x=(w-text_w)/2:y=h*0.30:text_shaping=1`
    const subtitleFilter = subtitleEsc
      ? `,drawtext=text='${subtitleEsc}'${fontArg}:fontcolor=${fgColor}@0.85:fontsize=42:x=(w-text_w)/2:y=h*0.45:line_spacing=20`
      : ''
    const brandFilter = `drawtext=text='Hermes TTS'${fontArg}:fontcolor=${fgColor}@0.5:fontsize=28:x=(w-text_w)/2:y=h*0.92`

    const drawtext = `${titleFilter},${brandFilter}${subtitleFilter}`

    // Generate background + audio with ffmpeg
    // Use color source + drawtext overlay + audio input
    const cmd = [
      'ffmpeg -y',
      `-f lavfi -i "color=c=${bgColor}:s=${resolution.width}x${resolution.height}:d=${duration}"`,
      `-i "${audioFile}"`,
      `-filter_complex "[0:v]${drawtext}[v]"`,
      `-map "[v]" -map 1:a`,
      `-c:v libx264 -preset fast -crf 23`,
      `-c:a aac -b:a 128k`,
      `-pix_fmt yuv420p`,
      `-shortest`,
      `"${videoFile}"`,
    ].join(' ')

    execSync(cmd, { stdio: 'pipe' })

    const buf = fs.readFileSync(videoFile)
    return buf
  } finally {
    try { fs.unlinkSync(audioFile) } catch { /* ignore */ }
    try { fs.unlinkSync(videoFile) } catch { /* ignore */ }
  }
}

/**
 * Locate a CJK font available on the system.
 * Falls back to "Arial" if not found.
 */
function findFontFile() {
  const candidates = [
    '/System/Library/Fonts/PingFang.ttc',         // macOS
    '/System/Library/Fonts/STHeiti Medium.ttc',   // macOS
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', // Linux
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', // Linux
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',          // Linux
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',          // Linux
    'C:/Windows/Fonts/msyh.ttc',                                 // Windows
    'C:/Windows/Fonts/msyh.ttf',                                 // Windows
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch { /* ignore */ }
  }
  return null
}

module.exports = {
  buildShort,
  SHORTS_RESOLUTIONS,
}
