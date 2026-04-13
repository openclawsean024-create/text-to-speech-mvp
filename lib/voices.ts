export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export type Gender = 'male' | 'female'
export type Age = 'adult' | 'young' | 'teen'
export type Language = 'zh' | 'en' | 'ja' | 'ko' | 'multi'

export interface Voice {
  id: string
  name: string
  gender: Gender
  age: Age
  language: Language
  previewText: string
  openaiVoice: OpenAIVoice
  description?: string
}

export const VOICES: Voice[] = [
  // Male voices
  {
    id: 'male-adult-onyx',
    name: '深沉大叔',
    gender: 'male',
    age: 'adult',
    language: 'multi',
    previewText: '您好，這是沉穩有力的男性聲線。',
    openaiVoice: 'onyx',
    description: '成熟穩重的成人男聲',
  },
  {
    id: 'male-young-echo',
    name: '陽光男孩',
    gender: 'male',
    age: 'young',
    language: 'multi',
    previewText: '嗨，歡迎來到文字轉語音的世界！',
    openaiVoice: 'echo',
    description: '活力充沛的年輕男聲',
  },
  {
    id: 'male-deep-fable',
    name: '磁音低音',
    gender: 'male',
    age: 'adult',
    language: 'en',
    previewText: 'Hello, this is a deep and rich male voice.',
    openaiVoice: 'fable',
    description: '磁性低沉的角色男聲',
  },
  // Female voices
  {
    id: 'female-adult-nova',
    name: '知性姐姐',
    gender: 'female',
    age: 'adult',
    language: 'multi',
    previewText: '您好，歡迎使用文字轉語音服務。',
    openaiVoice: 'nova',
    description: '成熟知性的成人女聲',
  },
  {
    id: 'female-young-shimmer',
    name: '甜心少女',
    gender: 'female',
    age: 'young',
    language: 'multi',
    previewText: '嗨嗨，今天過得怎麼樣呢？',
    openaiVoice: 'shimmer',
    description: '甜美可愛的年輕女聲',
  },
  {
    id: 'female-warm-alloy',
    name: '溫暖阿姨',
    gender: 'female',
    age: 'adult',
    language: 'multi',
    previewText: '別擔心，一切都會好起來的。',
    openaiVoice: 'alloy',
    description: '溫暖柔和的成熟女聲',
  },
  // Youth voices
  {
    id: 'teen-male-onyx',
    name: '少年正太',
    gender: 'male',
    age: 'teen',
    language: 'zh',
    previewText: '同學們，今天我們來學習新知識！',
    openaiVoice: 'onyx',
    description: '清亮的少年男聲',
  },
  {
    id: 'teen-female-nova',
    name: '少女清脆',
    gender: 'female',
    age: 'teen',
    language: 'zh',
    previewText: '哇，這個功能好酷啊！',
    openaiVoice: 'nova',
    description: '清脆可愛的少女聲',
  },
  // Multilingual voices
  {
    id: 'multi-en-fable',
    name: 'English Native',
    gender: 'male',
    age: 'adult',
    language: 'en',
    previewText: 'Hello, welcome to our text to speech service.',
    openaiVoice: 'fable',
    description: 'Native English male voice',
  },
  {
    id: 'multi-ja-alloy',
    name: '日本語女性',
    gender: 'female',
    age: 'adult',
    language: 'ja',
    previewText: 'こんにちは、ようこそ。音声合成の世界へ。',
    openaiVoice: 'alloy',
    description: '自然流暢的日語女聲',
  },
  {
    id: 'multi-ko-shimmer',
    name: '한국어 여성',
    gender: 'female',
    age: 'adult',
    language: 'ko',
    previewText: '안녕하세요, 목소리 합성에 오신 것을 환영합니다.',
    openaiVoice: 'shimmer',
    description: '自然流暢的韓語女聲',
  },
  {
    id: 'multi-zh-nova',
    name: '中文普通話',
    gender: 'female',
    age: 'adult',
    language: 'zh',
    previewText: '您好，歡迎使用文字轉語音服務。這是語音預覽。',
    openaiVoice: 'nova',
    description: '標準普通話女聲',
  },
]

export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  multi: '多語言',
}

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男性',
  female: '女性',
}

export const AGE_LABELS: Record<Age, string> = {
  adult: '成人',
  young: '年輕',
  teen: '青少年',
}

export function getVoiceById(id: string): Voice | undefined {
  return VOICES.find(v => v.id === id)
}

export function filterVoices(
  voices: Voice[],
  filter: { gender?: Gender | 'all'; age?: Age | 'all'; language?: Language | 'all'; showFavorites?: boolean },
  favorites: string[]
): Voice[] {
  let result = [...voices]

  if (filter.showFavorites) {
    result = result.filter(v => favorites.includes(v.id))
  }

  if (filter.gender && filter.gender !== 'all') {
    result = result.filter(v => v.gender === filter.gender)
  }

  if (filter.age && filter.age !== 'all') {
    result = result.filter(v => v.age === filter.age)
  }

  if (filter.language && filter.language !== 'all') {
    result = result.filter(v => v.language === filter.language)
  }

  // Always put favorites at top
  const favs = result.filter(v => favorites.includes(v.id))
  const nonFavs = result.filter(v => !favorites.includes(v.id))

  return [...favs, ...nonFavs]
}
