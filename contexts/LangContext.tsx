'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export type Locale = 'zh' | 'en'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const copy: Record<Locale, Record<string, string>> = {
  zh: {
    // Header
    'app.title': 'AI 文字轉語音',
    'app.subtitle': '多引擎 AI TTS',
    'app.version': 'v2.0',
    // Nav buttons
    'nav.pricing': '定價',
    'nav.dashboard': '控制台',
    'nav.login': '登入',
    'nav.logout': '登出',
    'nav.localeToggle': 'EN',
    // Hero
    'hero.badge': '支援 OpenAI · ElevenLabs · Kokoro',
    'hero.headline': 'Transform Text into Natural Speech',
    'hero.headline.accent': '文字轉化為自然語音',
    'hero.subheadline': 'Choose top AI engines and voice styles, generate broadcast-quality narration instantly',
    'hero.stats.lang': '6+ 語言',
    'hero.stats.instant': '即時生成',
    'hero.stats.mp3': 'MP3 輸出',
    // File Upload
    'upload.label': '上傳檔案',
    'upload.dropzone': '點擊或拖曳檔案至此',
    'upload.ext': '支援格式',
    'upload.ext.list': '.txt .srt .vtt .lrc .epub .pdf .docx',
    // Mode
    'mode.label': '轉換模式',
    'mode.browser': 'Browser Mode',
    'mode.browser.sub': '免費，無需登入',
    'mode.api': 'AI 雲端',
    'mode.api.sub': '高品質，需要登入',
    'mode.engine': '選擇 TTS 引擎',
    'mode.plan': '選擇方案',
    'mode.plan.free': 'Free',
    'mode.plan.free.quota': '10次/天',
    'mode.plan.starter': 'Starter',
    'mode.plan.starter.quota': '100次/天',
    'mode.plan.pro': 'Pro',
    'mode.plan.pro.quota': '1000次/天',
    'mode.apikey': 'API Key',
    'mode.apikey.hint': '留空則使用已儲存的 Key',
    'mode.apikey.placeholder.openai': 'sk-...',
    'mode.apikey.placeholder.elevenlabs': 'ElevenLabs Key...',
    'mode.apikey.placeholder.kokoro': 'inference.sh Key...',
    'mode.apikey.note': 'Key 只會儲存在您瀏覽器的本機端，或安全地儲存在',
    'mode.apikey.note.link': '控制台',
    'mode.login.hint': '請先',
    'mode.login.hint.btn': '登入',
    'mode.login.hint.suffix': '才能使用 API 模式',
    // Text Input
    'text.label': '輸入文字',
    'text.placeholder': '輸入要轉換的文字，或上傳檔案...',
    'text.counter': '{count} / 5,000',
    'text.duration': '預估時長',
    'text.chunks': '段落',
    // Voice
    'voice.label': '選擇聲音',
    'voice.preview': '試聽',
    // Speed
    'speed.label': '速度設定',
    'speed.speed': '速度',
    'speed.pitch': '音高',
    'speed.volume': '音量',
    // Convert
    'convert.btn': '開始轉換',
    'convert.converting': '轉換中，請稍候...',
    // Result
    'result.title': '轉換完成！',
    'result.subtitle': 'MP3 音檔已就緒',
    'result.download': '下載音檔',
    // History
    'history.label': '轉換紀錄',
    'history.clear': '清除',
    // Status messages
    'status.unsupported': '不支援的格式: .{ext}',
    'status.fileLarge': '檔案超過 10MB 限制',
    'status.extracting': '正在提取文字，請稍候...',
    'status.extracted': '已提取 {count} 字元：{filename}',
    'status.fileError': '檔案讀取失敗',
    'status.noText': '請輸入文字後再轉換',
    'status.textTooLong': '文字不能超過 5000 字元',
    'status.loginRequired': '請先登入才能使用 API 模式',
    'status.playing': 'Playing... browser mode',
    'status.complete': '轉換完成 — {engine} 引擎',
    'status.downloadStart': '下載已開始',
    'status.error': '轉換失敗',
    // Footer
    'footer.powered': '技術支援：OpenAI · ElevenLabs · Kokoro',
    // Login alert
    'alert.clerk': '請設定 Clerk API Key 以啟用登入功能',
  },
  en: {
    // Header
    'app.title': 'AI Text to Speech',
    'app.subtitle': 'Multi-Engine AI TTS',
    'app.version': 'v2.0',
    // Nav buttons
    'nav.pricing': 'Pricing',
    'nav.dashboard': 'Dashboard',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'nav.localeToggle': '中',
    // Hero
    'hero.badge': 'Supports OpenAI · ElevenLabs · Kokoro',
    'hero.headline': 'Transform Text into Natural Speech',
    'hero.headline.accent': 'Text into Natural Speech',
    'hero.subheadline': 'Choose top AI engines and voice styles, generate broadcast-quality narration instantly',
    'hero.stats.lang': '6+ Languages',
    'hero.stats.instant': 'Instant generation',
    'hero.stats.mp3': 'MP3 output',
    // File Upload
    'upload.label': 'Upload File',
    'upload.dropzone': 'Click or drag files here',
    'upload.ext': 'Supported formats',
    'upload.ext.list': '.txt .srt .vtt .lrc .epub .pdf .docx',
    // Mode
    'mode.label': 'Conversion Mode',
    'mode.browser': 'Browser Mode',
    'mode.browser.sub': 'Free, no login required',
    'mode.api': 'AI Cloud',
    'mode.api.sub': 'High quality, login required',
    'mode.engine': 'Select TTS Engine',
    'mode.plan': 'Select Plan',
    'mode.plan.free': 'Free',
    'mode.plan.free.quota': '10/day',
    'mode.plan.starter': 'Starter',
    'mode.plan.starter.quota': '100/day',
    'mode.plan.pro': 'Pro',
    'mode.plan.pro.quota': '1000/day',
    'mode.apikey': 'API Key',
    'mode.apikey.hint': '(leave empty to use saved)',
    'mode.apikey.placeholder.openai': 'sk-...',
    'mode.apikey.placeholder.elevenlabs': 'ElevenLabs Key...',
    'mode.apikey.placeholder.kokoro': 'inference.sh Key...',
    'mode.apikey.note': 'Key is only stored locally in your browser, or securely in the',
    'mode.apikey.note.link': 'Dashboard',
    'mode.login.hint': 'Please',
    'mode.login.hint.btn': 'login',
    'mode.login.hint.suffix': 'first to use API mode',
    // Text Input
    'text.label': 'Enter Text',
    'text.placeholder': 'Enter text to convert, or upload a file...',
    'text.counter': '{count} / 5,000',
    'text.duration': 'Est. duration',
    'text.chunks': 'chunks',
    // Voice
    'voice.label': 'Select Voice',
    'voice.preview': 'Preview',
    // Speed
    'speed.label': 'Speed Setting',
    'speed.speed': 'Speed',
    'speed.pitch': 'Pitch',
    'speed.volume': 'Volume',
    // Convert
    'convert.btn': 'Start Conversion',
    'convert.converting': 'Converting, please wait...',
    // Result
    'result.title': 'Conversion Complete!',
    'result.subtitle': 'MP3 audio file is ready',
    'result.download': 'Download Audio',
    // History
    'history.label': 'Conversion History',
    'history.clear': 'Clear',
    // Status messages
    'status.unsupported': 'Unsupported format: .{ext}',
    'status.fileLarge': 'File exceeds 10MB limit',
    'status.extracting': 'Extracting text, please wait...',
    'status.extracted': 'Extracted {count} characters: {filename}',
    'status.fileError': 'File read failed',
    'status.noText': 'Please enter text to convert',
    'status.textTooLong': 'Text cannot exceed 5000 characters',
    'status.loginRequired': 'Please login first to use API mode',
    'status.playing': 'Playing... browser mode',
    'status.complete': 'Conversion complete — {engine} engine',
    'status.downloadStart': 'Download started',
    'status.error': 'Conversion failed',
    // Footer
    'footer.powered': 'Powered by AI · OpenAI · ElevenLabs · Kokoro',
    // Login alert
    'alert.clerk': 'Please set Clerk API Key to enable login',
  },
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh')

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem('tts_locale', l)
    } catch (_) {}
  }, [])

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('tts_locale') as Locale | null
      if (saved === 'zh' || saved === 'en') setLocaleState(saved)
    } catch (_) {}
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let value = copy[locale][key] ?? copy.en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, String(v))
    }
    return value
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

/**
 * Interpolate a translation string with {key} placeholders.
 * e.g. t('status.extracted', { count: 123, filename: 'a.txt' })
 */
export function tl(key: string, vars?: Record<string, string | number>): string {
  const locale = 'zh' // default; actual resolution happens in component
  let str = copy['zh'][key] ?? copy['en'][key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v))
    })
  }
  return str
}

export { copy }
