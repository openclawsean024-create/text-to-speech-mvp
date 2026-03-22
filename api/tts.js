/**
 * POST /api/tts
 *
 * Body (JSON):
 * {
 *   text: string,          // required, max 5000 chars
 *   engine?: string,       // 'openai' | 'elevenlabs' | 'kokoro', default 'openai'
 *   voice?: string,        // engine-specific voice ID or name
 *   speed?: number,        // 0.5 - 2.0, default 1.0
 *   plan?: string,         // 'free' | 'starter' | 'pro', default 'free'
 * }
 *
 * Headers:
 *   Authorization: Bearer <API_KEY>   (optional for now, required when user system is in)
 *
 * Responses:
 *   200: audio/mpeg or audio/wav
 *   400: bad request (missing text, invalid engine)
 *   429: rate limit exceeded
 *   500: internal error
 */

const { synthesize } = require('../lib/tts-engines');
const { rateLimit } = require('../lib/rate-limiter');

const ALLOWED_ENGINES = ['openai', 'elevenlabs', 'kokoro'];

// Map frontend voice codes to engine-specific voices
const VOICE_MAP = {
  // Browser/Web Speech codes → engine defaults
  'zh-CN': { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN' },
  'zh-TW': { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-TW' },
  'en-US': { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US' },
  'ja-JP': { openai: 'nova',     elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ja-JP' },
  'ko-KR': { openai: 'fable',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ko-KR' },
  'en-US-male': { openai: 'onyx', elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US' },
};

function resolveVoice(engine, frontendVoice) {
  if (!frontendVoice) return undefined;
  // If it's already an engine-specific voice ID (UUID-like), return as-is
  if (engine === 'elevenlabs' && frontendVoice.length > 30) return frontendVoice;
  const mapped = VOICE_MAP[frontendVoice];
  return mapped ? mapped[engine] : undefined;
}

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate Limiting ──────────────────────────────────────
  const plan = (req.body?.plan || req.query?.plan || 'free');
  rateLimit(plan)(req, res, () => {});

  // If rate limit was exceeded, res was already sent
  if (res.headersSent) return;

  // ── Parse Body ─────────────────────────────────────────
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { text, engine = 'openai', voice: frontendVoice, speed = 1.0 } = body;

  // ── Validation ──────────────────────────────────────────
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'text exceeds 5000 character limit' });
  }
  if (!ALLOWED_ENGINES.includes(engine)) {
    return res.status(400).json({
      error: `Invalid engine. Allowed: ${ALLOWED_ENGINES.join(', ')}`,
    });
  }

  // ── Resolve API Key ─────────────────────────────────────
  // Priority: request body key > env key (server-side)
  const apiKey = body.apiKey || process.env[`${engine.toUpperCase()}_API_KEY`] || null;

  if (!apiKey) {
    return res.status(400).json({
      error: `API key required for ${engine}. Set ${engine.toUpperCase()}_API_KEY environment variable or pass apiKey in request body.`,
    });
  }

  // ── Resolve voice ───────────────────────────────────────
  const voice = resolveVoice(engine, frontendVoice) || frontendVoice;

  // ── Synthesize ──────────────────────────────────────────
  try {
    const result = await synthesize({
      engine,
      text: text.trim(),
      voice,
      speed: parseFloat(speed),
      apiKey,
    });

    const filename = `tts-${engine}-${Date.now()}.mp3`;

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-TTS-Engine', result.engine);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.status(200).send(result.audio);
  } catch (err) {
    console.error(`[TTS] ${engine} error:`, err.message);

    if (err.message.includes('API key') || err.message.includes('401') || err.message.includes('403')) {
      return res.status(401).json({ error: 'Invalid API key. Please check your API key configuration.' });
    }
    if (err.message.includes('429')) {
      return res.status(429).json({ error: 'Upstream API rate limit exceeded. Please try again later.' });
    }
    if (err.message.includes('insufficient_quota') || err.message.includes('quota')) {
      return res.status(402).json({ error: 'API quota exceeded. Please upgrade your plan or wait until quota resets.' });
    }

    res.status(500).json({ error: `TTS synthesis failed: ${err.message}` });
  }
};
