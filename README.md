# 文字轉語音 v3.0 — Hermes TTS 統一介面 + Podcast 後製工廠

> **一個介面做配音 + 後製，繁中微調 + 多引擎聚合 + 企業 API，月省 30 小時。**

Hermes TTS 是繁中 (Traditional Chinese) 唯一的 AI 雙引擎 SaaS：

1. **TTS 介面層 (Hermes Unified Interface)** — 聚合 5 個頂級 TTS 引擎 (OpenAI gpt-4o-mini-tts、ElevenLabs Multilingual v2、Kokoro、Azure Neural TTS、Google Cloud TTS)，繁中 UI + 12 種情緒 × 12 種角色 × 12 種預設 + 一鍵直出 YouTube Shorts 9:16。
2. **Podcast 後製工廠** — 上傳 MP3 / WAV (≤ 500MB)，自動跑 Whisper 繁中逐字稿 + GPT 章節自動命名 + SRT/VTT 字幕 + 3 段摘要 + ePub 文字稿 + 個人詞彙表 (50 詞)。
3. **企業 API (NT$2,999/月)** — `POST /api/v1/process` + webhook 回傳 + tier-based rate limit + SHA-256 hashed API key。

🌐 **Live**: https://text-to-speech-mvp.vercel.app  
📦 **Repo**: https://github.com/openclawsean024-create/text-to-speech-mvp  
📋 **SPEC**: [`PRD/SPEC.md`](./PRD/SPEC.md)  
📘 **CI Setup**: [`docs/CI.md`](./docs/CI.md)

---

## 🎯 三大甜蜜點

| 痛點 | 對手缺點 | Hermes 解法 |
|---|---|---|
| 自媒體月 30-60 支短影音配音 | ElevenLabs $5+ 英文 UI、繁中 WER 12% | **繁中 UI + 5 引擎聚合 + 9:16 直出** |
| 視障者教材有聲化 | 雅婷僅台語、無後製 | **NT$99 個人版 + 章節 + 字幕 + 摘要** |
| Podcast 60 分鐘後製 | 真人 NT$3.2K-6.4K、Otter 英文 | **5 分鐘出章節 + 字幕 + 摘要 + ePub** |
| 企業 IVR + Podcast 整合 | 3 套拆買 ≈ NT$11K/月 | **NT$2,999 一條龍 API + Webhook** |

---

## ✨ 功能總覽 (F-001 ~ F-009)

| ID | 功能 | 對應端點 |
|---|---|---|
| **F-001** | MP3/WAV 上傳 (≤ 500MB) | `POST /api/v1/process` |
| **F-002** | Whisper 繁中逐字稿 + 時間戳 | (同上 pipeline) |
| **F-003** | GPT-4o-mini 章節自動命名 (3-12 段) | `GET /api/v1/jobs/[id]/download?format=chapters.json` |
| **F-004** | SRT / VTT 字幕匯出 | `?format=srt` 或 `?format=vtt` |
| **F-005** | 三段 AI 摘要 (短/詳/重點) | `?format=summary.json` |
| **F-006** | ePub 2.0 文字稿匯出 | `?format=epub` |
| **F-007** | 個人詞彙表 (free 20 / personal 50 / creator 200 / business 500 詞) | `GET/POST /api/glossary` |
| **F-008** | **Hermes TTS 統一介面** (5 引擎) | `POST /api/tts` + `GET /api/catalog` |
| **F-009** | 繁中 prompt 預訓練 5000 句 + 12 情緒 × 12 角色 × 12 預設 + YouTube Shorts 9:16 | `POST /api/shorts` |
| **F-104** | SHA-256 hashed API key + tier-based 月度額度 | `POST/GET/DELETE /api/v1/keys` |

---

## 🚀 快速開始 (Local Dev)

```bash
# 安裝依賴 (pnpm 推薦)
pnpm install

# 複製環境變數
cp .env.example .env
# 編輯 .env — 填入至少 OPENAI_API_KEY (其他可選)

# 啟動 dev server
pnpm dev    # http://localhost:3000

# 建置生產版本
pnpm build
pnpm start
```

### 最少環境變數

```bash
OPENAI_API_KEY=sk-...                  # 必填 (TTS + Whisper + GPT)
CLERK_SECRET_KEY=sk_test_...           # 選填 (登入功能)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  # 選填
KV_REST_API_URL=...                    # 選填 (持久化 jobs/keys)
KV_REST_API_TOKEN=...
```

> 沒有 Clerk / KV 也能跑 — demo mode 自動啟用，所有資料存在記憶體 (重啟會清掉)。

---

## 📐 架構

```
Next.js 14 App Router  +  TypeScript
├── app/
│   ├── page.tsx                       # TTS 首頁
│   ├── dashboard/                     # 使用量 + API Key 管理
│   ├── pricing/                       # 定價
│   ├── login/  signup/                # Clerk 認證
│   └── api/
│       ├── tts/                       # F-008 Hermes TTS 統一介面
│       ├── catalog/                   # 引擎/情緒/角色/預設 catalog
│       ├── shorts/                    # F-009 YouTube Shorts 9:16
│       ├── glossary/                  # F-007 個人詞彙表
│       ├── keys/                      # 個人 API key 管理
│       ├── usage/                     # 用量查詢
│       ├── health/                    # 健康檢查
│       ├── v1/
│       │   ├── process/               # F-001~F-006 企業 API
│       │   └── jobs/[id]/             # 狀態 + 下載
│       ├── billing/
│       │   ├── checkout/              # 建立 NewebPay checkout
│       │   └── subscription/          # 查詢 + 取消訂閱
│       └── webhook/
│           ├── newebpay/              # 藍新金流 NotifyURL
│           └── test/                  # HMAC 簽章測試
├── components/                        # UI (VoiceSelector / BatchQueue / ...)
├── lib/
│   ├── tts-engines.js                 # 5 引擎實作 (OpenAI/ElevenLabs/Kokoro/Azure/Google)
│   ├── tts-prompts.js                 # 繁中 12×12×12 prompt catalog
│   ├── whisper.js                     # F-002 Whisper 轉錄 (OpenAI + Groq 備援)
│   ├── post-process.js                # F-003/F-004/F-005 GPT 章節 + SRT/VTT + 摘要
│   ├── epub.js                        # F-006 ePub 2.0 產生器 (pure JS)
│   ├── shorts.js                      # F-009 ffmpeg 9:16 影片
│   ├── api-keys.ts                    # F-104 API key CRUD + tier
│   ├── webhook.js                     # HMAC 簽章 + 重試 backoff
│   ├── jobs.ts                        # Job queue (KV-backed)
│   ├── glossary.ts                    # F-007 詞彙表 (tier-aware 限額)
│   ├── newebpay.js                    # 藍新金流 AES-CBC + CheckValue
│   └── subscriptions.ts               # 訂閱儲存 + 自動降級
└── PRD/
    └── SPEC.md                        # v3.0 完整規格 (24 區塊)
```

---

## 💰 定價 (3 層 tier)

| 方案 | 月費 | TTS 額度 | 後製額度 | 詞彙表 | API |
|---|---|---|---|---|---|
| 🆓 **Free** | NT$0 | 5 分/月 | 30 分/月 | 20 詞 | ❌ |
| 👤 **Personal** | **NT$99** | 30 分/月 | 1 hr/月 | 50 詞 | ❌ |
| 🎙️ **Creator** | **NT$299** | 3 hr/月 | 10 hr/月 | 200 詞 | ❌ |
| 🏢 **Business API** | **NT$2,999** | 50 hr/月 | 200 hr/月 | 500 詞 | ✅ + Webhook |
| 🎯 **Custom** | NT$9,999+ | 不限 | 不限 | 500 詞 | ✅ |

**個人版** 對標 Spotify Premium NT$149 心理門檻 (省 34%)。  
**創作者版** 對標真人剪輯 NT$800-1,600/集 (省 70%+)。  
**企業版** 對標 ElevenLabs $330 + Otter $20 + Descript $24 ≈ NT$11K (省 73%)。

> 訂閱透過 **NewebPay (藍新金流)** — 台灣本地信用卡/ATM/超商，支援 30 天滿意度保證。

---

## 🛠️ API 範例

### TTS 統一介面 (F-008)

```bash
curl -X POST https://text-to-speech-mvp.vercel.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "哈囉大家好，歡迎來到 Hermes TTS！",
    "engine": "azure",
    "voice": "zh-TW-HsiaoChenNeural",
    "emotion": "excited",
    "speed": 1.0,
    "format": "mp3"
  }' \
  --output output.mp3
```

支援 `engine`: `openai` | `elevenlabs` | `kokoro` | `azure` | `google`

### 企業後製 API (F-001~F-006)

```bash
# 1. 上傳音檔 → 拿到 job_id
curl -X POST https://text-to-speech-mvp.vercel.app/api/v1/process \
  -H "Authorization: Bearer hms_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/podcast.mp3",
    "settings": {
      "chapters": true,
      "summary": true,
      "subtitles": true,
      "epub": false,
      "glossary": "Sui, Move, zkLogin, Aptos",
      "language": "zh"
    },
    "options": {
      "webhookUrl": "https://your-server.com/webhooks/hermes"
    }
  }'
# Response: { ok: true, job_id: "...", status: "queued", estimated_minutes: 18 }

# 2. 輪詢狀態
curl https://text-to-speech-mvp.vercel.app/api/v1/jobs/JOB_ID \
  -H "Authorization: Bearer hms_your_key_here"

# 3. 下載字幕
curl "https://text-to-speech-mvp.vercel.app/api/v1/jobs/JOB_ID/download?format=srt" \
  -H "Authorization: Bearer hms_your_key_here" \
  --output subtitles.srt
```

支援下載格式：`srt` | `vtt` | `epub` | `chapters.json` | `summary.json` | `transcript.json` | `transcript.txt`

### Webhook 回傳格式

```json
{
  "job_id": "abc123",
  "status": "done",
  "duration_sec": 3600,
  "chapters": [{"title": "開場", "startSec": 0, "endSec": 60, "key_points": [...]}],
  "summary": {"short": "...", "detailed": "...", "bullets": ["...", "..."]},
  "subtitles": {
    "srt": "https://.../download?format=srt",
    "vtt": "https://.../download?format=vtt"
  }
}
```

HMAC 簽章 header: `X-Signature: sha256=<hex>` (用 `WEBHOOK_SECRET` 驗證)

### API Key 管理 (F-104)

```bash
# 建立
curl -X POST https://text-to-speech-mvp.vercel.app/api/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"tier": "business"}'
# Response: { api_key: "hms_xxxxxxx...", tier: "business", ... }
# ⚠️ 立刻儲存 api_key — 不會再顯示

# 列表
curl https://text-to-speech-mvp.vercel.app/api/v1/keys
# Response: { keys: [{ id, tier, used_sec, usage_percent, ... }] }

# 撤銷
curl -X DELETE "https://text-to-speech-mvp.vercel.app/api/v1/keys?id=KEY_ID"
```

### YouTube Shorts 9:16 (F-009)

```bash
curl -X POST https://text-to-speech-mvp.vercel.app/api/shorts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你今天一定要試試這 5 個 AI 工具...",
    "title": "5 個必學 AI 工具",
    "subtitle": "新手也能上手",
    "engine": "azure",
    "voice": "zh-TW-HsiaoChenNeural",
    "emotion": "excited",
    "aspect": "9:16"
  }' \
  --output shorts.mp4
```

產出 1080×1920 MP4，可直接上傳 YouTube Shorts / IG Reels / TikTok。

### 詞彙表 (F-007)

```bash
# 讀取 (預設 demo 模式可讀但寫需登入)
curl https://text-to-speech-mvp.vercel.app/api/glossary

# 設定詞彙
curl -X POST https://text-to-speech-mvp.vercel.app/api/glossary \
  -H "Content-Type: application/json" \
  -d '{
    "action": "set",
    "words": ["Sui", "Move", "zkLogin", "Aptos", "Layer1"],
    "tier": "personal"
  }'

# 加入詞彙
curl -X POST https://text-to-speech-mvp.vercel.app/api/glossary \
  -H "Content-Type: application/json" \
  -d '{"action": "add", "words": ["DeepBook"]}'

# 移除單詞
curl -X POST https://text-to-speech-mvp.vercel.app/api/glossary \
  -H "Content-Type: application/json" \
  -d '{"action": "remove", "word": "Move"}'
```

詞彙會自動注入 Whisper prompt，提升專有名詞辨識率。

---

## 📊 Acceptance Criteria (SPEC §3.4)

| ID | 場景 | 驗證方式 |
|---|---|---|
| **AC-0001** | 上傳 60 分鐘 MP3，5 分鐘內收到 email + 通知，60 分鐘音檔 WER < 12% | 觀察 `/api/v1/jobs/[id]` status + duration |
| **AC-0002** | 章節自動命名：≤ 20 字、可讀、可編輯 | 看 `chapters[].title` |
| **AC-0003** | 字幕時間戳精準 ±0.5s，含 speaker label | 下載 SRT 比對音檔 |
| **AC-0004** | 詞彙表 WER 改善 (vs 原始 12% → < 5%) | 注入 glossary 後重跑 |
| **AC-0005** | 企業 API < 10 分鐘回傳 webhook + JSON | 設定 webhookUrl 並觀察 |

---

## 🔧 開發

```bash
# 開發模式 (HMR)
pnpm dev

# 型別檢查 (CI 必跑)
npx tsc --noEmit

# Lint
pnpm lint

# 生產建置
pnpm build && pnpm start

# Smoke tests (CI 跑同樣的東西)
node -e "
  const tts = require('./lib/tts-engines.js');
  console.log('TTS engines:', tts.SUPPORTED_ENGINES);
  const pp = require('./lib/post-process.js');
  console.log('SRT:', pp.toSrt([{start:0,end:5,text:'哈囉'}]).slice(0, 100));
"
```

### 環境需求

- Node.js 18+
- pnpm 11+ (推薦) 或 npm 10+
- ffmpeg + ffprobe (Shorts 9:16 / WAV 轉換) — `apt install ffmpeg` 或 `brew install ffmpeg`
- CJK 字型 (Noto CJK / PingFang / Microsoft YaHei)

---

## 🚢 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/openclawsean024-create/text-to-speech-mvp)

### Vercel 設定步驟

1. 建立 Vercel project，連結 GitHub repo
2. 在 **Settings → Environment Variables** 加入 `.env.example` 列出所有變數
3. 在 **Storage** 建立 KV database (`hnd1` region 推薦)
4. 推送 `master` 自動部署 → 取得 live URL
5. (選填) 在 Clerk 建立 application，設定 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`

### 必填環境變數

| 變數 | 用途 |
|---|---|
| `OPENAI_API_KEY` | TTS (gpt-4o-mini-tts) + Whisper + GPT 章節 |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Vercel KV (jobs + API keys + glossary + subs) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` | 用戶登入 (選填) |

### 選填環境變數

| 變數 | 用途 |
|---|---|
| `ELEVENLABS_API_KEY` | F-008 引擎 #2 |
| `KOKORO_API_KEY` (or `INFERENCE_SH_API_KEY`) | F-008 引擎 #3 |
| `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` | F-008 引擎 #4 |
| `GOOGLE_TTS_API_KEY` (or `GOOGLE_API_KEY`) | F-008 引擎 #5 |
| `GROQ_API_KEY` | Whisper 備援引擎 |
| `RESEND_API_KEY` | Email 通知 |
| `NEWEBPAY_MERCHANT_ID` + `NEWEBPAY_HASH_KEY` + `NEWEBPAY_HASH_IV` | 訂閱金流 |
| `WEBHOOK_SECRET` | HMAC 簽章密鑰 |

---

## 🛡️ 安全

- API keys **SHA-256 雜湊** 儲存 (plaintext 只在建立時顯示一次)
- Rate limit 預設 **1 req/sec** per key (business tier 可調)
- Webhook payload **HMAC-SHA256 簽章** (`X-Signature: sha256=<hex>`)
- 音檔 30 天後自動刪除 (GDPR 相容)
- 用戶音檔僅可本人讀取 (signed URL)

---

## 📋 Tech Stack

| Layer | 選擇 |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + Tailwind 3 |
| Backend | Next.js API Routes (serverless) |
| Auth | Clerk (demo mode: 跳過認證) |
| Storage | Vercel KV (Upstash Redis) |
| Payment | NewebPay (藍新) MPG |
| AI | OpenAI (gpt-4o-mini-tts, Whisper, GPT-4o-mini), ElevenLabs, Kokoro, Azure Neural TTS, Google Cloud TTS |
| Video | ffmpeg (H.264 + AAC) |
| Deployment | Vercel |

---

## 📝 License

MIT

---

## 🙏 致謝

- SPEC 設計: Sophia (CPO)
- Engineering: Alan (CTO) + 開發團隊
- Powered by Next.js + Vercel + OpenAI
