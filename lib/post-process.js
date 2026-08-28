/**
 * Post-production pipeline — F-003 / F-004 / F-005
 *
 * GPT chapter segmentation + SRT/VTT subtitle export + 3-tier summary.
 *
 * Uses GPT-4o-mini (cheap, good enough for繁中 chapter naming).
 * Falls back to Qwen-style heuristic segmentation when GPT is unavailable.
 */

const OpenAI = require('openai')

// ────────────────────────────────────────────────────────────────────────────
// F-003: GPT chapter segmentation + auto-naming
// ────────────────────────────────────────────────────────────────────────────

const CHAPTER_PROMPT = `你是繁體中文 podcast 章節命名師。輸入是逐字稿 + 對應時間戳（秒）。

任務：
1. 識別段落主題切換（topic shift），切成 3-12 段
2. 給每段 5-20 字繁中標題，使用常見中文動詞（的、是、怎麼、如何）
3. 確保標題不重複、不模糊、可讀性高
4. 標題可選 0-2 個 emoji

輸入是 JSON 陣列，每個元素含 {start, end, text}。

輸出 JSON 陣列，每個元素含 {title, startSec, endSec, key_points: string[]}。
startSec/endSec 必須在輸入 segments 範圍內，標題繁中、≤ 20 字、不重複。
只回傳 JSON，不要其他文字。`

async function chaptersWithGPT({ segments, apiKey, glossary = '', targetChapters = 6 }) {
  if (!apiKey) throw new Error('OpenAI API key required for chapter segmentation')
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    throw new Error('segments required')
  }

  const client = new OpenAI({ apiKey })

  // Compact segments — pass every Nth segment to fit context
  const compact = segments.map((s) => ({ start: s.start, end: s.end, text: (s.text || '').slice(0, 200) }))
  const userContent = JSON.stringify({ glossary, segments: compact })

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: CHAPTER_PROMPT },
      { role: 'user', content: userContent.slice(0, 50000) },
    ],
    response_format: { type: 'json_object' },
  })

  const text = completion.choices?.[0]?.message?.content || '{}'
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    console.warn('[chapters] GPT returned non-JSON, falling back to heuristic:', text.slice(0, 200))
    return chaptersHeuristic({ segments, targetChapters })
  }

  // Expected: { chapters: [...] } or direct array
  let chapters = Array.isArray(parsed) ? parsed : parsed.chapters || parsed.segments || []
  if (!Array.isArray(chapters) || chapters.length === 0) {
    console.warn('[chapters] GPT returned empty array, falling back to heuristic')
    return chaptersHeuristic({ segments, targetChapters })
  }

  // Sanitize — clamp to segment range, dedupe titles, enforce 20-char limit
  const seen = new Set()
  const cleaned = []
  for (const ch of chapters) {
    const title = String(ch.title || ch.name || '').trim().slice(0, 20)
    if (!title || seen.has(title)) continue
    seen.add(title)
    const startSec = Math.max(0, Number(ch.startSec ?? ch.start ?? 0))
    const endSec = Math.max(startSec + 1, Number(ch.endSec ?? ch.end ?? startSec + 1))
    cleaned.push({
      title,
      startSec,
      endSec,
      key_points: Array.isArray(ch.key_points) ? ch.key_points.slice(0, 5) : [],
    })
  }

  if (cleaned.length < 3) {
    // Too few — augment with heuristic
    return chaptersHeuristic({ segments, targetChapters })
  }

  return cleaned
}

/**
 * Heuristic chapter segmentation — split by time windows + topic markers.
 * Used when GPT is unavailable or returns too few chapters.
 */
function chaptersHeuristic({ segments, targetChapters = 6 }) {
  if (!segments || segments.length === 0) return []

  const totalDuration = segments[segments.length - 1]?.end || 0
  const chapters = []
  const total = Math.max(3, Math.min(12, targetChapters))
  const windowSize = totalDuration / total

  // Topic markers in繁中 podcast — common transitions
  const topicMarkers = [
    '接下來', '再來', '那', '然後', '接著', '下一個', '剛才', '前面', '後面',
    '說到', '提到', '講到', '聊到', '談到', '進入', '我們來看', '分享一下',
    '首先', '再來是', '最後', '總結', '結論',
  ]

  for (let i = 0; i < total; i++) {
    const windowStart = Math.floor(i * windowSize)
    const windowEnd = Math.floor((i + 1) * windowSize)
    const segsInWindow = segments.filter((s) => s.start >= windowStart && s.start < windowEnd)
    if (segsInWindow.length === 0) continue

    // First sentence in window that has a topic marker → use as title
    let title = ''
    for (const s of segsInWindow) {
      const text = (s.text || '').trim()
      for (const marker of topicMarkers) {
        if (text.includes(marker)) {
          title = text.replace(/^[。！？，、\s]+/, '').split(/[。！？\n]/)[0].slice(0, 20)
          break
        }
      }
      if (title) break
    }
    if (!title) {
      const first = segsInWindow[0].text.trim().slice(0, 20)
      title = first || `段落 ${i + 1}`
    }

    chapters.push({
      title: title.slice(0, 20),
      startSec: windowStart,
      endSec: windowEnd,
      key_points: segsInWindow.slice(0, 3).map((s) => (s.text || '').trim().slice(0, 80)),
    })
  }

  return chapters
}

/**
 * Dispatcher — GPT first, heuristic fallback.
 */
async function segmentChapters({ segments, openaiKey, glossary, targetChapters }) {
  if (openaiKey) {
    try {
      const result = await chaptersWithGPT({ segments, apiKey: openaiKey, glossary, targetChapters })
      if (result && result.length >= 3) return result
    } catch (err) {
      console.warn('[chapters] GPT failed:', err.message, '— using heuristic')
    }
  }
  return chaptersHeuristic({ segments, targetChapters })
}

// ────────────────────────────────────────────────────────────────────────────
// F-004: SRT / VTT subtitle export
// ────────────────────────────────────────────────────────────────────────────

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function formatVttTime(seconds) {
  return formatSrtTime(seconds).replace(',', '.')
}

function toSrt(segments) {
  if (!segments || !Array.isArray(segments)) return ''
  return segments
    .filter((s) => (s.text || '').trim().length > 0)
    .map((s, i) => {
      const start = typeof s.start === 'number' ? s.start : 0
      const end = typeof s.end === 'number' ? s.end : start + 2
      const text = (s.text || '').trim().replace(/\s+/g, ' ')
      const speaker = s.speaker ? `[${s.speaker}] ` : ''
      return `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${speaker}${text}\n`
    })
    .join('\n')
}

function toVtt(segments) {
  const cues = (segments || [])
    .filter((s) => (s.text || '').trim().length > 0)
    .map((s, i) => {
      const start = typeof s.start === 'number' ? s.start : 0
      const end = typeof s.end === 'number' ? s.end : start + 2
      const text = (s.text || '').trim().replace(/\s+/g, ' ')
      const speaker = s.speaker ? `<v ${s.speaker}>${text}</v>` : text
      return `${i + 1}\n${formatVttTime(start)} --> ${formatVttTime(end)}\n${speaker}\n`
    })
    .join('\n')
  return `WEBVTT\n\n${cues}`
}

// ────────────────────────────────────────────────────────────────────────────
// F-005: 3-tier AI summary (短 / 詳 / 重點)
// ────────────────────────────────────────────────────────────────────────────

const SUMMARY_PROMPT = `你是繁體中文 podcast 摘要師。輸入是逐字稿（含時間戳）。

任務：輸出三種摘要的 JSON 物件：
{
  "short": "50 字內一句話摘要",
  "detailed": "300-500 字詳摘要，含主題脈絡 + 重要論點",
  "bullets": ["• 重點 1", "• 重點 2", "• 重點 3", "• 重點 4", "• 重點 5"]
}

要求：
- 全繁體中文，不用中國用語
- bullets 5-8 條
- 重要人名 / 數據 / 專有名詞照原文保留
- 只回傳 JSON`

async function summaryWithGPT({ segments, chapters, apiKey }) {
  if (!apiKey) throw new Error('OpenAI API key required for summary')
  const client = new OpenAI({ apiKey })

  // Build compact transcript text (limit context size)
  const transcript = (segments || [])
    .map((s) => `[${Math.floor(s.start)}s] ${(s.text || '').trim()}`)
    .join('\n')
    .slice(0, 30000)

  const chapterCtx = (chapters || [])
    .map((c) => `【${c.title}】${c.startSec}-${c.endSec}s`)
    .join(', ')

  const userContent = `章節：${chapterCtx}\n\n逐字稿：\n${transcript}`

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
  })

  const text = completion.choices?.[0]?.message?.content || '{}'
  try {
    const parsed = JSON.parse(text)
    return {
      short: String(parsed.short || '').slice(0, 100),
      detailed: String(parsed.detailed || '').slice(0, 1000),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 10) : [],
      engine: 'gpt-4o-mini',
    }
  } catch (e) {
    console.warn('[summary] GPT returned non-JSON:', text.slice(0, 200))
    return summaryHeuristic({ segments, chapters })
  }
}

function summaryHeuristic({ segments, chapters }) {
  // Quick heuristic: first segment + last segment + chapter titles
  const transcript = (segments || []).map((s) => (s.text || '').trim()).join(' ')
  const words = transcript.split(/[，。！？；：、\s]+/).filter(Boolean)

  const firstSentence = transcript.split(/[。！？]/)[0] || ''
  const bullets = (chapters || []).slice(0, 7).map((c) => `• ${c.title}`)

  return {
    short: firstSentence.slice(0, 50),
    detailed: `本集共 ${segments?.length || 0} 段逐字稿，總詞數約 ${words.length} 字。\n\n${firstSentence.slice(0, 200)}`,
    bullets: bullets.length > 0 ? bullets : ['• 自動章節切分', '• 繁中逐字稿', '• 字幕輸出'],
    engine: 'heuristic',
  }
}

async function summarize({ segments, chapters, openaiKey }) {
  if (openaiKey) {
    try {
      return await summaryWithGPT({ segments, chapters, apiKey: openaiKey })
    } catch (err) {
      console.warn('[summary] GPT failed:', err.message, '— using heuristic')
    }
  }
  return summaryHeuristic({ segments, chapters })
}

module.exports = {
  segmentChapters,
  chaptersHeuristic,
  toSrt,
  toVtt,
  formatSrtTime,
  formatVttTime,
  summarize,
  summaryHeuristic,
}
