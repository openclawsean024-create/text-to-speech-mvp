/**
 * GET /api/health
 * Returns server status and available TTS engines
 */
module.exports = async function handler(req, res) {
  const engines = {
    openai:     { available: !!process.env.OPENAI_API_KEY, envVar: 'OPENAI_API_KEY' },
    elevenlabs: { available: !!process.env.ELEVENLABS_API_KEY, envVar: 'ELEVENLABS_API_KEY' },
    kokoro:     { available: !!process.env.KOKORO_API_KEY || !!process.env.INFERENCE_SH_API_KEY, envVar: 'KOKORO_API_KEY or INFERENCE_SH_API_KEY' },
  };

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    engines,
    limits: {
      free:    { requestsPerDay: 10 },
      starter: { requestsPerDay: 100 },
      pro:     { requestsPerDay: 1000 },
    },
  });
};
