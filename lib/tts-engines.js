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

/** ElevenLabs TTS */
async function elevenlabsTTS({ text, voice, speed = 1.0, apiKey }) {
  if (!apiKey) throw new Error('ElevenLabs API key required');

  // voice ID: if user provides a voice ID use it directly
  // otherwise use a default voice
  const voiceId = voice && !['alloy','echo','fable','onyx','nova','shimmer'].includes(voice)
    ? voice
    : '21m00Tcm4TlvDq8ikWAM'; // Rachel - default English female

  const headers = {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  };

  // Optimize settings for quality
  const modelId = 'eleven_multilingual_v2';

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
        speed: Math.min(Math.max(speed, 0.5), 1.5),
      },
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

/** inference.sh Kokoro TTS (fallback / existing engine) */
async function kokoroTTS({ text, voice = 'zh-CN', speed = 1.0, apiKey }) {
  if (!apiKey) throw new Error('inference.sh API key required');

  const response = await fetch('https://api.inference.sh/v1/tts/kokoro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ voice, text, speed }),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const body = await response.json();
        msg = body.error?.message || body.error?.code || msg;
      } else {
        const text = await response.text();
        if (text) msg += ': ' + text.slice(0, 200);
      }
    } catch (_) {}
    throw new Error(msg);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  return {
    audio: buffer,
    contentType,
    engine: 'kokoro',
    voice,
  };
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
