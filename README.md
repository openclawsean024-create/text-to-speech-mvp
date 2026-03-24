# 文字轉語音 v2.0

多引擎 AI TTS 服務，支援 OpenAI、ElevenLabs、Kokoro。

## 功能

- 🌐 **瀏覽器內建語音** - 免費，無需 API Key
- 🎙️ **OpenAI gpt-4o-mini-tts** - 高品質，支援 30+ 語言
- 🎧 **ElevenLabs Multilingual v2** - 專業配音品質
- 🔉 **Kokoro (inference.sh)** - 開源方案
- 📊 **使用量儀表板** - 追蹤每日/每月使用量
- 🔑 **API Key 管理** - 安全儲存你的 API Key
- 📁 **多格式支援** - TXT, SRT, VTT, LRC, EPUB, PDF, DOCX

## 架構

```
Next.js 14 App Router
├── app/
│   ├── page.tsx          # TTS 首頁 (landing)
│   ├── pricing/page.tsx  # 定價頁面
│   ├── dashboard/page.tsx # 使用量儀表板 + API Key 管理
│   └── api/
│       ├── tts/          # TTS 合成 API
│       ├── keys/         # API Key CRUD
│       ├── usage/        # 使用量查詢
│       └── health/       # 健康檢查
├── components/           # UI 組件
└── lib/                  # 工具函式
```

## 快速開始

```bash
npm install
npm run dev
```

## 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/openclawsean024-create/text-to-speech-mvp)

## 環境變數設定

### Clerk (用戶系統)

1. 前往 [dashboard.clerk.com](https://dashboard.clerk.com) 建立應用
2. 複製 Publishable Key 和 Secret Key
3. 在 Vercel 設定環境變數：

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Vercel KV (資料儲存)

1. 在 Vercel Dashboard → Storage → Create KV Database
2. 選擇 region (建議 `hnd1` - 東京)
3. 將 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 加入環境變數

### API Keys (可選)

如果你想提供預設 API Key（用戶未自備時使用）：

```
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
KOKORO_API_KEY=...
INFERENCE_SH_API_KEY=...
```

## 使用流程

1. **註冊/登入** - 使用 Clerk 認證
2. **設定 API Key** - 在控制台儲存你的 OpenAI/ElevenLabs Key
3. **開始轉換** - 選擇引擎，輸入文字，享受高品質 TTS

## 方案說明

| 方案 | 每日限制 | 引擎 |
|------|---------|------|
| 🌐 免費 | 10 次 | 瀏覽器語音 |
| ⚡ Starter | 100 次 | 所有引擎 |
| 🚀 Pro | 1000 次 | 所有引擎 |

## 開發

```bash
# 本地開發
npm run dev

# 建置
npm run build

# 生產部署
vercel --prod
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: Clerk
- **Storage**: Vercel KV (Upstash Redis)
- **Styling**: Tailwind CSS
- **TTS Engines**: OpenAI, ElevenLabs, Kokoro (inference.sh)
- **Deployment**: Vercel
