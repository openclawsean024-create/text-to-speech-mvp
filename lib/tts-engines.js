/**
 * TTS Engine Adapters
 * Each engine returns { audio: Buffer, contentType: string, duration?: number }
 */

const OpenAI = require('openai');

/** OpenAI TTS (gpt-4o-mini-tts) */
async function openaiTTS({ text, voice = 'alloy', speed = 1.0, apiKey }) {
  const client = new OpenAI({ apiKey });

  const allowedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const selectedVoice = allowedVoices.includes(voice) ? voice : 'alloy';
  const clampedSpeed = Math.min(Math.max(speed, 0.25), 4.0);

  const response = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: selectedVoice,
    input: text,
    speed: clampedSpeed,
    response_format: 'mp3',
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    audio: buffer,
    contentType: 'audio/mpeg',
    engine: 'openai',
    voice,
    speed: clampedSpeed,
  };
}

/** ElevenLabs TTS - Optimized for Chinese and multilingual naturalness */
const ELEVENLABS_VOICE_MAP = {
  // Female voices (verified ElevenLabs IDs)
  'zh-CN':      '21m00Tcm4TlvDq8ikWAM',   // Rachel (English female — multilingual covers Chinese)
  'en-US':      '21m00Tcm4TlvDq8ikWAM',   // Rachel
  'ja-JP':      '21m00Tcm4TlvDq8ikWAM',   // Rachel (multilingual covers Japanese)
  'ko-KR':      '21m00Tcm4TlvDq8ikWAM',   // Rachel (multilingual covers Korean)
  // Male voices (verified)
  'zh-TW':      'AZnzlk1XvdvUeBnXmlZG',   // Antoni (male)
  'en-US-male': 'AZnzlk1XvdvUeBnXmlZG',   // Antoni (male)
}

async function elevenlabsTTS({ text, voice, speed = 1.0, apiKey }) {
  if (!apiKey) throw new Error('ElevenLabs API key required');

  // Resolve frontend voice code → ElevenLabs voice ID
  // If already an ElevenLabs ID (not OpenAI voice name), use directly
  const isOpenAIVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voice);
  const voiceId = isOpenAIVoice
    ? (ELEVENLABS_VOICE_MAP[voice] || '21m00Tcm4TlvDq8ikWAM')
    : (ELEVENLABS_VOICE_MAP[voice] || voice || '21m00Tcm4TlvDq8ikWAM');

  const headers = {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  };

  // Use eleven_multilingual_v2 for better Chinese and multilingual support
  // Optimize settings for natural Chinese pronunciation
  const modelId = 'eleven_multilingual_v2';

  // Adjust settings based on language detection (simple heuristic)
  const isChinese = /[\u4e00-\u9fff]/.test(text);
  
  // Optimize for Chinese: higher stability, adjusted style for naturalness
  const voiceSettings = isChinese ? {
    stability: 0.4,           // Slightly lower for more natural flow
    similarity_boost: 0.85,    // Higher similarity for better voice match
    style: 0.15,               // Lower style for less robotic Chinese
    use_speaker_boost: true,
    speed: Math.min(Math.max(speed, 0.5), 1.5),
  } : {
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.2,
    use_speaker_boost: true,
    speed: Math.min(Math.max(speed, 0.5), 1.5),
  };

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`ElevenLabs error: ${err.detail?.message || response.statusText} (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    audio: buffer,
    contentType: 'audio/mpeg',
    engine: 'elevenlabs',
    voice: voiceId,
  };
}

/**
 * inference.sh Kokoro TTS
 *
 * Supports two inference.sh API modes:
 * 1. Streaming: POST https://api.inference.sh/v1/tts  (direct audio response)
 * 2. App runner: POST https://api.inference.sh/apps/run  (task-based, may be async)
 *
 * Set KOKORO_API_URL env var to choose, or auto-detect based on response.
 * Default app ID: "kokoro" (via KOKORO_APP_ID env var).
 */
async function kokoroTTS({ text, voice = 'zh-CN-female', speed = 1.0, apiKey }) {
  if (!apiKey) throw new Error('inference.sh API key required');

  const appId  = process.env.KOKORO_APP_ID || 'kokoro';
  const baseUrl = process.env.KOKORO_API_URL || 'https://api.inference.sh';
  const clampedSpeed = Math.min(Math.max(parseFloat(speed) || 1.0, 0.5), 2.0);

  // Try the direct TTS endpoint first (streaming), then fall back to app runner
  const endpoints = [
    // Direct TTS (preferred — returns audio directly when supported)
    { url: `${baseUrl}/v1/tts`, body: { text, voice, speed: clampedSpeed } },
    // App runner (task-based; may return task ID requiring polling)
    { url: `${baseUrl}/apps/run`, body: { app: appId, input: { text, voice, speed: clampedSpeed } } },
  ];

  for (const { url, body } of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && !contentType.includes('application/json')) {
        // Direct audio returned — this is what we want
        const buffer = Buffer.from(await response.arrayBuffer());
        const resolvedContentType = contentType.split(';')[0].trim() || 'audio/mpeg';
        return {
          audio: buffer,
          contentType: resolvedContentType,
          engine: 'kokoro',
          voice,
        };
      }

      // JSON response (task created or error)
      if (contentType.includes('application/json')) {
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error?.message || json.error || `HTTP ${response.status}`);
        }

        // Task created — try polling once, then give up gracefully
        if (json.id) {
          const pollUrl = `${baseUrl}/v1/tasks/${json.id}`;
          for (let attempt = 0; attempt < 3; attempt++) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            const pollResp = await fetch(pollUrl, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (pollResp.ok) {
              const pollJson = await pollResp.json();
              if (pollJson.status === 'completed' && pollJson.output) {
                // output may be a URL or base64 audio
                if (typeof pollJson.output === 'string') {
                  if (pollJson.output.startsWith('data:')) {
                    // base64 data URI
                    const b64 = pollJson.output.split(',')[1];
                    return { audio: Buffer.from(b64, 'base64'), contentType: 'audio/mpeg', engine: 'kokoro', voice };
                  }
                  // URL to fetch
                  const audioResp = await fetch(pollJson.output);
                  const buf = Buffer.from(await audioResp.arrayBuffer());
                  return { audio: buf, contentType: 'audio/mpeg', engine: 'kokoro', voice };
                }
              }
              if (pollJson.status === 'failed') {
                throw new Error('Kokoro task failed: ' + (pollJson.error || 'unknown'));
              }
            }
          }
          // Poll exhausted — report it clearly
          throw new Error(
            `Kokoro async task (ID: ${json.id}) did not complete in time. ` +
            `Try setting KOKORO_API_URL to a direct streaming endpoint.`
          );
        }
      }
    } catch (err) {
      // If this was the last endpoint, re-throw; otherwise continue
      if (url === endpoints[endpoints.length - 1].url) throw err;
      console.warn(`[Kokoro] ${url} failed (${err.message}), trying next endpoint…`);
    }
  }

  throw new Error('All Kokoro endpoints exhausted');
}

/** Dispatcher */
async function synthesize({ engine = 'openai', text, voice, speed, apiKey }) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('text is required and must be a non-empty string');
  }
  if (text.length > 5000) {
    throw new Error('text exceeds 5000 character limit');
  }

  switch (engine) {
    case 'openai':
      return openaiTTS({ text, voice, speed, apiKey });
    case 'elevenlabs':
      return elevenlabsTTS({ text, voice, speed, apiKey });
    case 'kokoro':
      return kokoroTTS({ text, voice, speed, apiKey });
    default:
      throw new Error(`Unknown TTS engine: ${engine}`);
  }
}

module.exports = { synthesize, openaiTTS, elevenlabsTTS, kokoroTTS };
