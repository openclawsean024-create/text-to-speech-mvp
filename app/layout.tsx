import './globals.css'
import ClerkLoader from '@/components/ClerkLoader'
import { LocaleProvider } from '@/contexts/LangContext'
import { QueueProvider } from '@/contexts/QueueContext'
import { VoiceProvider } from '@/contexts/VoiceContext'

export const metadata = {
  title: '文字轉語音 v2.0 — 多引擎 AI TTS',
  description: '支援 OpenAI gpt-4o-mini-tts、ElevenLabs、Kokoro，多語言 AI 文字轉語音服務',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230071e3' stroke-width='2'><path d='M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z'/><path d='M19 10v2a7 7 0 0 1-14 0v-2'/><line x1='12' y1='19' x2='12' y2='22'/></svg>",
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
