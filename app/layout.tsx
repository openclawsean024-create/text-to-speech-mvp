import './globals.css'
import ClerkLoader from '@/components/ClerkLoader'

export const metadata = {
  title: '文字轉語音 v2.0 — 多引擎 AI TTS',
  description: '支援 OpenAI gpt-4o-mini-tts、ElevenLabs、Kokoro，多語言 AI 文字轉語音服務',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎙️</text></svg>",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <ClerkLoader>{children}</ClerkLoader>
      </body>
    </html>
  )
}
