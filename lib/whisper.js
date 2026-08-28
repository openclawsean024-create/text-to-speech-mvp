/**
 * Whisper transcription — F-002
 *
 * OpenAI Whisper API wrapper with繁中 timestamp segment output.
 * Falls back to Groq (whisper-large-v3) if OpenAI key is missing.
 *
 * Output: { segments: [{ start, end, text, speaker? }], language, duration }
 */

const OpenAI = require('openai')

async function transcribeWithOpenAI({ audio, mimeType, filename, language = 'zh', apiKey, prompt, response_format = 'verbose_json' }) {
  if (!apiKey) throw new Error('OpenAI API key required for Whisper')
  const client = new OpenAI({ apiKey })

  // audio: Buffer | Blob-like (Node fetch body)
  // Need a File-like object for OpenAI SDK
  const { File } = require('node:buffer') || {}
  let fileLike
  try {
    const { Blob } = require('node:buffer')
    fileLike = new Blob([audio], { type: mimeType || 'audio/mpeg' })
    // Set filename property for OpenAI SDK
    Object.defineProperty(fileLike, 'name', { value: filename || 'audio.mp3' })
  } catch {
    // Fallback: pass as Buffer directly (OpenAI SDK supports both)
    fileLike = audio
  }

  const result = await client.audio.transcriptions.create({
    file: fileLike,
    model: 'whisper-1',
    language,
    prompt,
    response_format,
    temperature: 0,
  })

  // verbose_json gives segments
  if (result && Array.isArray(result.segments)) {
    return {
      language: result.language || language,
      duration: result.duration,
      text: result.text,
      segments: result.segments.map((s) => ({
        start: typeof s.start === 'number' ? s.start : 0,
        end: typeof s.end === 'number' ? s.end : 0,
        text: s.text || '',
      })),
      engine: 'openai-whisper',
    }
  }

  // text_only fallback
  return {
    language: result?.language || language,
    duration: result?.duration,
    text: typeof result === 'string' ? result : result?.text || '',
    segments: [],
    engine: 'openai-whisper',
  }
}

async function transcribeWithGroq({ audio, mimeType, filename, language = 'zh', apiKey, prompt }) {
  if (!apiKey) throw new Error('Groq API key required for Whisper fallback')
  // Groq Whisper API mirrors OpenAI's
  const { Blob } = require('node:buffer')
  const fileLike = new Blob([audio], { type: mimeType || 'audio/mpeg' })
  Object.defineProperty(fileLike, 'name', { value: filename || 'audio.mp3' })

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: (() => {
      const fd = new FormData()
      fd.append('file', fileLike, filename || 'audio.mp3')
      fd.append('model', 'whisper-large-v3')
      fd.append('language', language)
      fd.append('response_format', 'verbose_json')
      if (prompt) fd.append('prompt', prompt)
      return fd
    })(),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Groq error: ${response.status} ${errText.slice(0, 200)}`)
  }

  const result = await response.json()
  return {
    language: result.language || language,
    duration: result.duration,
    text: result.text,
    segments: (result.segments || []).map((s) => ({
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      text: s.text || '',
    })),
    engine: 'groq-whisper',
  }
}

/**
 * Dispatcher — tries OpenAI first, falls back to Groq.
 *
 * @param {Object} params
 * @param {Buffer} params.audio
 * @param {string} [params.mimeType]
 * @param {string} [params.filename]
 * @param {string} [params.language]   ISO code, default 'zh'
 * @param {string} [params.glossary]   comma-separated terms for Whisper prompt
 * @param {string} [params.openaiKey]
 * @param {string} [params.groqKey]
 */
async function transcribe(params = {}) {
  const {
    audio,
    mimeType = 'audio/mpeg',
    filename = 'audio.mp3',
    language = 'zh',
    glossary = '',
    openaiKey,
    groqKey,
  } = params

  if (!audio || !Buffer.isBuffer(audio)) {
    throw new Error('audio Buffer is required')
  }

  // Build prompt for繁中 — first 224 tokens of prompt are used as hint
  // Inject glossary terms as hint
  const prompt = glossary
    ? `以下是繁體中文的 podcast 內容。專有名詞：${glossary}。請保留原始繁體用字。`
    : '以下是繁體中文的 podcast 內容。請保留原始繁體用字。'

  if (openaiKey) {
    try {
      return await transcribeWithOpenAI({ audio, mimeType, filename, language, apiKey: openaiKey, prompt })
    } catch (err) {
      console.warn('[whisper] OpenAI failed:', err.message, '— falling back to Groq')
      if (groqKey) return await transcribeWithGroq({ audio, mimeType, filename, language, apiKey: groqKey, prompt })
      throw err
    }
  }

  if (groqKey) {
    return await transcribeWithGroq({ audio, mimeType, filename, language, apiKey: groqKey, prompt })
  }

  throw new Error('No Whisper API key configured. Set OPENAI_API_KEY or GROQ_API_KEY.')
}

module.exports = {
  transcribe,
  transcribeWithOpenAI,
  transcribeWithGroq,
}
