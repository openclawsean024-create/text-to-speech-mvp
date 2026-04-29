import './globals.css'
import ClerkLoader from '@/components/ClerkLoader'
import { LocaleProvider } from '@/contexts/LangContext'
import { QueueProvider } from '@/contexts/QueueContext'
import { VoiceProvider } from '@/contexts/VoiceContext'

export const metadata = {
  metadataBase: new URL('https://text-to-speech-mvp.vercel.app'),
  title: {
    default: '文字轉語音 v2.0 — 多引擎 AI TTS',
    template: '%s | 文字轉語音 v2.0',
  },
  description: '支援 OpenAI gpt-4o-mini-tts、ElevenLabs、Kokoro 的多語言 AI 文字轉語音服務。支援 EPUB、PDF、DOCX 直接轉換，免費開始使用。',
  keywords: ['文字轉語音', 'TTS', 'AI語音', 'OpenAI TTS', 'ElevenLabs', 'Kokoro', 'text to speech', 'AI voice', '多語言語音合成', '文字朗讀'],
  authors: [{ name: 'Alan' }],
  creator: 'Alan',
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: 'https://text-to-speech-mvp.vercel.app',
    siteName: '文字轉語音 v2.0',
    title: '文字轉語音 v2.0 — 多引擎 AI TTS',
    description: '支援 OpenAI、ElevenLabs、Kokoro，多語言 AI 文字轉語音。直接上傳 EPUB、PDF、DOCX，幾秒鐘完成轉換。',
    images: [{
      url: '/screenshot.png',
      width: 1200,
      height: 630,
      alt: '文字轉語音 v2.0 - 多引擎 AI TTS',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '文字轉語音 v2.0 — 多引擎 AI TTS',
    description: '支援 OpenAI、ElevenLabs、Kokoro，多語言 AI 文字轉語音。',
    images: ['/screenshot.png'],
    creator: '@Alan',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238B5CF6' stroke-width='2'><path d='M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z'/><path d='M19 10v2a7 7 0 0 1-14 0v-2'/><line x1='12' y1='19' x2='12' y2='22'/></svg>", type: 'image/svg+xml' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <ClerkLoader>
          <LocaleProvider>
            <QueueProvider>
              <VoiceProvider>
                {children}
              </VoiceProvider>
            </QueueProvider>
          </LocaleProvider>
        </ClerkLoader>
      </body>
    </html>
  )
}
