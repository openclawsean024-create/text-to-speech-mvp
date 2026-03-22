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

/**
 * inference.sh Kokoro TTS
 *
 * Correct API: POST https://api.inference.sh/apps/run
 * Body: { "app": "kokoro", "input": { "text", "voice", "speed" } }
 *
 * App name can be overridden via KOKORO_APP_ID env var.
 * Default app ID: "kokoro" (official Kokoro TTS app on inference.sh)
 */
async function kokoroTTS({ text, voice = 'zh-CN', speed = 1.0, apiKey }) {
  if (!apiKey) throw new Error('inference.sh API key required');

  const appId = process.env.KOKORO_APP_ID || 'kokoro';

  const response = await fetch('https://api.inference.sh/apps/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      app: appId,
      input: {
        text,
        voice: voice || 'zh-CN',
        speed: Math.min(Math.max(parseFloat(speed) || 1.0, 0.5), 2.0),
      },
    }),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const body = await response.json();
        msg = body.error?.message || body.error || msg;
      } else {
        const textBody = await response.text();
        if (textBody) msg += ': ' + textBody.slice(0, 200);
      }
    } catch (_) {}
    throw new Error(msg);
  }

  // inference.sh returns a task object; poll for completion or expect direct audio
  const contentType = response.headers.get('content-type') || '';
  let buffer;
  let resolvedContentType = 'audio/mpeg';

  if (contentType.includes('application/json')) {
    // Task was created — currently we only support synchronous apps
    // For async tasks, the SDK handles polling; mark as needing implementation
    const task = await response.json();
    throw new Error(
      `Kokoro task created (ID: ${task.id}). ` +
      `inference.sh currently requires async polling — set KOKORO_SYNC=true ` +
      `or use a synchronous Kokoro endpoint. See: https://inference.sh/docs/api/running-apps`
    );
  }

  buffer = Buffer.from(await response.arrayBuffer());
  if (contentType) resolvedContentType = contentType.split(';')[0].trim();

  return {
    audio: buffer,
    contentType: resolvedContentType,
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
