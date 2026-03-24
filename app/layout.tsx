import './globals.css'
import ClerkLoader from '@/components/ClerkLoader'

export const metadata = {
  title: '文字轉語音 v2.0 - 多引擎 AI TTS',
  description: '支援 OpenAI、ElevenLabs、Kokoro 多引擎 AI 文字轉語音服務',
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
