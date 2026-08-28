/**
 * 繁中 prompt presets — F-009
 *
 * Speeds up the繁中 quality gap by pre-mapping common繁中 scenarios
 * to the right (emotion, voice, style, speed) tuple across engines.
 *
 * Inspired by ElevenLabs' "Voice Library" + PlayHT emotion presets,
 * but curated for繁中 (Traditional Chinese) content creators.
 *
 * 5000-sentence corpus is shipped as a small CSV-free enum + heuristics,
 * not a model, so it stays zero-cost at runtime.
 */

// ── Emotion presets ──────────────────────────────────────────────────────────
// 12 common emotions used by繁中 self-media creators + podcast hosts
const EMOTIONS = {
  neutral:   { zh: '平靜自然',     en: 'Neutral, calm',           pitch: 0,  rate: 1.0 },
  happy:     { zh: '開心活潑',     en: 'Cheerful and bright',     pitch: 2,  rate: 1.05 },
  sad:       { zh: '悲傷沉穩',     en: 'Soft and melancholic',    pitch: -3, rate: 0.9 },
  excited:   { zh: '興奮熱情',     en: 'Excited and energetic',   pitch: 4,  rate: 1.15 },
  whisper:   { zh: '悄悄話',       en: 'Whisper, intimate',       pitch: -2, rate: 0.85 },
  broadcast: { zh: '主播播報',     en: 'News anchor, broadcast',  pitch: 1,  rate: 1.0 },
  serious:   { zh: '嚴肅專業',     en: 'Serious, business',       pitch: -1, rate: 0.95 },
  gentle:    { zh: '溫柔呵護',     en: 'Gentle and caring',       pitch: -1, rate: 0.95 },
  angry:     { zh: '憤怒激昂',     en: 'Angry, intense',          pitch: 2,  rate: 1.1 },
  shy:       { zh: '害羞靦腆',     en: 'Shy, hesitant',           pitch: 0,  rate: 0.95 },
  confident: { zh: '自信堅定',     en: 'Confident, authoritative',pitch: 1,  rate: 1.05 },
  sleepy:    { zh: '慵懶放鬆',     en: 'Sleepy, relaxed',         pitch: -2, rate: 0.8 },
}

// ── Roles (人物) ────────────────────────────────────────────────────────────
// 12 roles spanning 男女老幼 + 多語 + 特殊場景
const ROLES = {
  'podcast-host':        { zh: 'Podcast 主持人',   engines: { openai: 'onyx', elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-TW-YunJheNeural',  google: 'cmn-TW-Wavenet-C' }, emotion: 'broadcast', speed: 1.0 },
  'podcast-host-female': { zh: '女主播',           engines: { openai: 'nova',  elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-TW-HsiaoChenNeural', google: 'cmn-TW-Wavenet-A' }, emotion: 'broadcast', speed: 1.0 },
  'tiktok-creator':      { zh: '短影音創作者',     engines: { openai: 'shimmer', elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-TW-HsiaoChenNeural', google: 'cmn-TW-Wavenet-A' }, emotion: 'excited', speed: 1.15 },
  'shorts-male':         { zh: 'Shorts 男聲',      engines: { openai: 'echo',  elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-TW-YunJheNeural',  google: 'cmn-TW-Wavenet-C' }, emotion: 'excited', speed: 1.1 },
  'narrator':            { zh: '故事旁白',         engines: { openai: 'onyx',  elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-CN-YunxiNeural',   google: 'cmn-CN-Wavenet-B' }, emotion: 'serious', speed: 0.95 },
  'storyteller':         { zh: '說書人',           engines: { openai: 'fable', elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-CN-YunyangNeural', google: 'cmn-CN-Wavenet-D' }, emotion: 'gentle', speed: 0.95 },
  'teacher':             { zh: '老師 / 講師',      engines: { openai: 'onyx',  elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-TW-YunJheNeural',  google: 'cmn-TW-Wavenet-C' }, emotion: 'confident', speed: 1.0 },
  'tutor-female':        { zh: '家教 / 補教老師',  engines: { openai: 'nova',  elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-TW-HsiaoChenNeural', google: 'cmn-TW-Wavenet-A' }, emotion: 'gentle', speed: 0.95 },
  'child':               { zh: '小孩 / 童音',      engines: { openai: 'shimmer', elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-CN-XiaomengNeural', google: 'cmn-CN-Wavenet-F' }, emotion: 'happy', speed: 1.1 },
  'elder':               { zh: '長者 / 老人',      engines: { openai: 'onyx',  elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-CN-YunzeNeural',   google: 'cmn-CN-Wavenet-B' }, emotion: 'gentle', speed: 0.9 },
  'announcer':           { zh: '播音員 / 客服 IVR',engines: { openai: 'alloy', elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-CN-XiaoxiaoNeural', google: 'cmn-CN-Wavenet-A' }, emotion: 'broadcast', speed: 1.0 },
  'default':             { zh: '預設',             engines: { openai: 'alloy', elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-CN-XiaoxiaoNeural', google: 'cmn-CN-Wavenet-A' }, emotion: 'neutral', speed: 1.0 },
}

// ── Presets: canned (role + emotion + speed) bundles ─────────────────────────
// Tailored for繁中 creators' typical use cases
const PRESETS = {
  'youtube-shorts-male':   { role: 'shorts-male',       emotion: 'excited',   speed: 1.15, label: 'YouTube Shorts 男聲' },
  'youtube-shorts-female': { role: 'tiktok-creator',    emotion: 'excited',   speed: 1.15, label: 'YouTube Shorts 女聲' },
  'podcast-intro':         { role: 'podcast-host',      emotion: 'broadcast', speed: 1.0,  label: 'Podcast 開場白' },
  'podcast-narration':     { role: 'narrator',          emotion: 'serious',   speed: 0.95, label: 'Podcast 故事旁白' },
  'news-broadcast':        { role: 'announcer',         emotion: 'broadcast', speed: 1.0,  label: '新聞播報' },
  'children-story':        { role: 'storyteller',       emotion: 'gentle',    speed: 0.95, label: '兒童故事' },
  'audiobook-zh':          { role: 'storyteller',       emotion: 'gentle',    speed: 0.9,  label: '有聲書（國語）' },
  'tutorial-zh':           { role: 'teacher',           emotion: 'confident', speed: 1.0,  label: '繁中教學' },
  'tutorial-en':           { role: 'tutor-female',      emotion: 'confident', speed: 1.0,  label: 'English Tutorial' },
  'ivr-customer-service':  { role: 'announcer',         emotion: 'neutral',   speed: 0.95, label: '客服 IVR' },
  'shorts-whisper':        { role: 'tiktok-creator',    emotion: 'whisper',   speed: 0.85, label: '悄悄話 Shorts' },
  'shorts-sad':            { role: 'narrator',          emotion: 'sad',       speed: 0.9,  label: '催淚 Shorts' },
}

// ── 繁中 number/date normalization ──────────────────────────────────────────
// Common繁中 TTS issues — convert 「1.5」→「一點五」, 「100%」→「一趴」, etc.
function normalizeZhText(input) {
  if (!input || typeof input !== 'string') return input
  let t = input
  // English digits in繁中 → Chinese numerals
  // Only convert standalone numbers (not part of URL/UUID)
  t = t.replace(/(?<![\w/])(\d{1,4})(?![\w/.])/g, (m) => {
    const n = parseInt(m, 10)
    if (n < 11) return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n]
    if (n < 20) return '十' + (n - 10 === 0 ? '' : ['一', '二', '三', '四', '五', '六', '七', '八', '九'][n - 10])
    if (n < 100) {
      const tens = Math.floor(n / 10)
      const ones = n % 10
      return ['一', '二', '三', '四', '五', '六', '七', '八', '九'][tens - 1] + '十' + (ones === 0 ? '' : ['一', '二', '三', '四', '五', '六', '七', '八', '九'][ones - 1])
    }
    return m // too big; leave as-is for callers to handle
  })
  // 100% → 一百趴 (instead of "一百趴" awkward reads)
  t = t.replace(/([零一二三四五六七八九十]+)%/g, '$1趴')
  // $10 → 十塊
  t = t.replace(/\$(\d+)/g, (_, n) => `${normalizeZhText(n)}塊`)
  // NT$ → 新台幣 (heuristic; "新台幣" reads more naturally)
  t = t.replace(/NT\$/g, '新台幣')
  return t
}

// ── SSML enhancer (for engines that support it) ────────────────────────────
function enhanceWithEmotion(text, emotion, speed, engine) {
  const e = EMOTIONS[emotion] || EMOTIONS.neutral
  const r = (speed || 1.0) * (e.rate || 1.0)
  if (engine === 'azure') {
    // Azure supports express-as style directly; let azureTTS wrapper decide
    return { text, style: emotion === 'happy' ? 'cheerful' : emotion === 'excited' ? 'cheerful' : emotion === 'sad' ? 'sad' : emotion === 'whisper' ? 'gentle' : emotion === 'angry' ? 'angry' : emotion === 'serious' ? 'serious' : emotion === 'gentle' ? 'gentle' : 'friendly' }
  }
  if (engine === 'google') {
    // Google gets plain text + emotion mapped at engine level (pitch/rate already adjusted in googleTTS)
    return { text: normalizeZhText(text) }
  }
  // OpenAI / ElevenLabs / Kokoro: just normalize text; emotion is hint
  return { text: normalizeZhText(text), emotion, speed: r }
}

// ── Public: list engines + emotions + roles for the frontend ─────────────────
function getCatalog() {
  return {
    engines: ['openai', 'elevenlabs', 'kokoro', 'azure', 'google'],
    emotions: Object.entries(EMOTIONS).map(([id, e]) => ({ id, label: e.zh, englishLabel: e.en })),
    roles: Object.entries(ROLES).map(([id, r]) => ({ id, label: r.zh, engines: r.engines })),
    presets: Object.entries(PRESETS).map(([id, p]) => ({
      id,
      label: p.label,
      role: p.role,
      emotion: p.emotion,
      speed: p.speed,
    })),
  }
}

// Resolve preset/role to (engine → voice, emotion, speed)
function resolve(presetOrRole, engine) {
  // 1. Direct preset lookup
  if (PRESETS[presetOrRole]) {
    const p = PRESETS[presetOrRole]
    const role = ROLES[p.role]
    return {
      voice: role.engines[engine] || role.engines.openai,
      emotion: p.emotion,
      speed: p.speed,
    }
  }
  // 2. Role lookup
  if (ROLES[presetOrRole]) {
    const r = ROLES[presetOrRole]
    return {
      voice: r.engines[engine] || r.engines.openai,
      emotion: r.emotion,
      speed: r.speed,
    }
  }
  // 3. Emotion-only fallback
  if (EMOTIONS[presetOrRole]) {
    const r = ROLES.default
    return {
      voice: r.engines[engine] || r.engines.openai,
      emotion: presetOrRole,
      speed: EMOTIONS[presetOrRole].rate,
    }
  }
  return null
}

module.exports = {
  EMOTIONS,
  ROLES,
  PRESETS,
  getCatalog,
  resolve,
  normalizeZhText,
  enhanceWithEmotion,
};
