# 文字轉語音 MVP — 規格計劃書 v2.2.1

> 版本：v2.2.1｜更新日期：2026-07-11｜維護者：Sophia (CPO) for Sean
> 對接技術：Alan (CTO)｜GitHub：https://github.com/openclawsean024-create/text-to-speech-mvp
> Live：https://text-to-speech-mvp.vercel.app

---

## 1. 產品概述 (Product Overview)

### 1.1 問題陳述 (Problem Statement)

**核心問題**：台灣 300 萬通勤族 + 6 萬視障者 + 10 萬內容創作者 + 50 萬語言學習者，總計約 366 萬潛在使用者，需要把文字轉成高品質語音，但市場上沒有「零月費起步 + 高品質 + 多語言 + 可下載 MP3」的整合方案。

**現有方案痛點**：
- 商用 TTS（Google Cloud TTS、ElevenLabs）：月費 USD 5-300，對個人用戶太貴
- 手機內建 TTS：品質差、無法批次 / 匯出 MP3
- 真人錄音：每次 NT$ 1,000-10,000，耗時且無法 scale
- NotebookLM 等只能聽不能下載：失去「二次使用」的彈性

**我們的解法**：瀏覽器內建 Web Speech API（免費） + OpenAI gpt-4o-mini-tts（$0.015/1K 字） + ElevenLabs Multilingual v2（高品質備援） + Kokoro open-source（自架備援），四引擎可切換，前端付費牆管配額。

### 1.2 目標使用者 (User Personas)

| Persona | 規模 | 痛點 | 預算 | 觸及管道 |
|---|---|---|---|---|
| 通勤族「阿德」30 歲工程師 | 300 萬 | 想用通勤時間吸收內容 | 免費 | PTT / Threads / Product Hunt |
| 視障者「小安」40 歲 | 6 萬 | 需要無障礙工具 | 免費 | 身障團體 / 社群 |
| 內容創作者「Nina」28 歲 | 10 萬 | 想做有聲內容但錄音成本高 | NT$99-499/月 | YouTube / Podcast 圈 |
| 語言學習者「Ray」25 歲 | 50 萬 | 想聽正確發音學外語 | NT$99/月 | Dcard / 語言交換社群 |

### 1.3 核心價值主張 (Value Proposition)

> 「**貼上文字 → 30 秒拿到 MP3** — 4 引擎可切換（瀏覽器 / OpenAI / ElevenLabs / Kokoro），20+ 語言，支援批次長文。」

**差異化**：
- **vs Google TTS**：我們 4 引擎切換（它只 1 個），價格彈性大
- **vs ElevenLabs 官網**：我們提供「先用瀏覽器免費試聽」funnel，再 upgrade
- **vs NotebookLM**：可下載 MP3、可批次、可商用

### 1.4 商業目標 (KPIs / OKRs)

| 時間 | 指標 | 目標 |
|---|---|---|
| **3 個月** | 註冊用戶 | 500 人 |
| **6 個月** | MRR（Monthly Recurring Revenue） | NT$ 30,000 |
| **12 個月** | 月成長率 | 25% MoM |
| **18 個月** | ARR | NT$ 800,000 |

### 1.5 Non-Goals (明確不做)

- ❌ **不做 deepfake / 真人聲音合成** — 法規風險高，平台聲明為資訊工具，使用者自負責任
- ❌ **不做商業配音市場** — ElevenLabs 已佔據，不正面競爭
- ❌ **不做影片配音 / 字幕生成** — 那是另一個垂直產品（Descript 等已佔據）
- ❌ **不做多用戶協作 / 團隊版** — 個人創作者工具，協作會複雜化
- ❌ **不做自訓 TTS 模型** — 開源 Kokoro + 商用 API 已足夠覆蓋 95% 場景
- ❌ **不做 SSML 完整支援** — MVP 階段太複雜，v3 再評估
- ❌ **不做 Podcast 自動發布** — Anchor / Spotify 整合成本高，ROI 低
- ❌ **不做行動 App** — Web 優先，PWA 即可滿足手機需求

---

## 2. 使用者場景與流程

### 2.1 使用者流程圖

```
┌────────────────────────────────────────────────────────────────┐
│                       TTS 使用者旅程                             │
└────────────────────────────────────────────────────────────────┘

[新使用者]
   │
   ▼
[1. Landing Page] (app/page.tsx)
   │  - 試聽瀏覽器內建 TTS（免費）
   │  - 看功能介紹 / 定價
   │
   ├──► [2a. 免費試聽] 30 秒拿到 MP3（瀏覽器引擎）
   │       │
   │       ▼
   │    [升級提示] 想用高品質？登入試 OpenAI / ElevenLabs
   │
   └──► [2b. 註冊/登入] Clerk Auth
           │
           ▼
        [3. Dashboard] (app/dashboard)
           │  - 輸入 API Key（OpenAI / ElevenLabs）
           │  - 看使用量儀表板
           │
           ▼
        [4. TTS 製作]
           │  - 貼文字 / 上傳 EPUB / PDF / DOCX / SRT / VTT / LRC
           │  - 選引擎（4 選 1）+ 選聲音 + 語速
           │  - 按下「轉換」
           │
           ├──► [4a. 短文 ≤ 5000 字] 一次合成
           └──► [4b. 長文 > 5000 字] 自動分段 + 合併 MP3
                  │
                  ▼
               [5. 下載 / 儲存]
                  │  - 直接下載 MP3
                  │  - 儲存到「我的音檔」（KV 持久化）
                  │
                  ▼
               [6. 配額用完？]
                  │  - Free: 10 req/day
                  │  - Starter: 100 req/day
                  │  - Pro: 1000 req/day
                  │
                  ▼
               [升級頁] (app/pricing)
                  │  - NT$99 / NT$499 / NT$2,999
                  │
                  ▼
               [Stripe Checkout] → 訂閱成功
```

### 2.2 關鍵用戶故事 (User Stories)

| ID | As a | I want to | So that |
|---|---|---|---|
| US-001 | 通勤族 | 貼上 PTT 文章網址自動抓文 + 轉語音 | 通勤時用耳機聽文章 |
| US-002 | 視障者 | 上傳 EPUB 一次轉成有聲書 | 不用盯螢幕 |
| US-003 | 創作者 | 選 ElevenLabs 引擎 + 台灣女聲 + 1.2x 語速 | 30 分鐘產出 Podcast 集 |
| US-004 | 語言學習者 | 比較同一段中文用 4 種引擎的發音 | 選最適合的練聽力 |
| US-005 | 開發者 | 拿 API Key 走 `/api/tts` 整合到自己的 App | 不用自己接 TTS provider |
| US-006 | 升級用戶 | 看使用量儀表板（今日/本月/總計） | 知道還剩多少配額 |
| US-007 | 批次用戶 | 上傳 50 頁 PDF 一次轉好 | 不用切 50 次 |

### 2.3 邊界場景 (Edge Cases)

| 情境 | 處理方式 |
|---|---|
| 文字含 HTML tag / Markdown | 先 strip 再合成 |
| 文字 > 5000 字 | 自動 split 段落 + 句號，平行合成，合併 MP3 |
| 文字是 emoji only | 回 400 E_TTS_EMPTY |
| 引擎 API 掛掉 | fallback 到下一個引擎，記 log |
| 使用者配額用完 | 回 429 E_RATE_LIMIT，導向升級頁 |
| 上傳檔案 > 10 MB | 回 413 E_FILE_TOO_LARGE |
| API Key 無效 | 回 401 E_INVALID_API_KEY |
| 網路瞬斷（合成中） | 客戶端自動 retry 1 次，2 次失敗顯示錯誤 |

---

## 3. 功能性需求 (Functional Requirements)

### 3.1 MVP (必做)

- [x] **F-001**：文字輸入（純文字 / Markdown / 檔案上傳 TXT/SRT/VTT/LRC/EPUB/PDF/DOCX）
- [x] **F-002**：4 種 TTS 引擎可切換（瀏覽器 / OpenAI / ElevenLabs / Kokoro）
- [x] **F-003**：20+ 種語言支援（瀏覽器免費，OpenAI 50+，ElevenLabs 29）
- [x] **F-004**：5+ 種聲音選擇（每引擎各自的預設聲音庫）
- [x] **F-005**：語速調整（0.5x - 2.0x）
- [x] **F-006**：MP3 下載 + 儲存到「我的音檔」（Vercel KV）
- [x] **F-007**：使用量儀表板（每日/每月/總計）
- [x] **F-008**：API Key 管理（每位使用者自帶 OpenAI / ElevenLabs Key 加密儲存）
- [x] **F-009**：配額管理（Free 10/day, Starter 100/day, Pro 1000/day）
- [x] **F-010**：多語言 UI（中/英）
- [x] **F-011**：Clerk Auth 登入/註冊
- [x] **F-012**：定價頁（3 個 tier）

### 3.2 v2 / v3 (加值)

- [ ] **F-101**：SSML 進階控制（停頓/重音/語氣）
- [ ] **F-102**：長文章智慧分段（> 5000 字）
- [ ] **F-103**：Podcast 自動發布（Spotify Anchor）
- [ ] **F-104**：聲音克隆（ElevenLabs Voice Design）
- [ ] **F-105**：批次上傳（一次最多 10 個檔案）
- [ ] **F-106**：客服系統（Intercom 整合）
- [ ] **F-107**：API 公開（developer 拿 API Key 走 REST）

### 3.3 Acceptance Criteria (Given/When/Then)

#### AC-001：文字輸入並合成 MP3

- **Given** 使用者在 TTS 首頁貼上 200 字的繁體中文
- **When** 點選「瀏覽器內建」引擎 + zh-TW 聲音 + 1.0x 語速，按下「轉換」
- **Then** 30 秒內回傳 MP3，瀏覽器自動播放 + 顯示下載連結

#### AC-002：長文自動分段

- **Given** 使用者貼上 8,000 字的長文（> 5000 字上限）
- **When** 按下「轉換」（OpenAI 引擎）
- **Then** 系統自動 split 段落成 2 chunks，依序合成，合併回單一 MP3，前端顯示進度條（50% → 100%）

#### AC-003：引擎切換

- **Given** 使用者輸入 300 字英文
- **When** 在 4 引擎間切換（瀏覽器 → OpenAI → ElevenLabs → Kokoro），每次按「轉換」
- **Then** 4 次皆回傳有效 MP3，聲音特徵明顯不同（瀏覽器最機械，ElevenLabs 最自然）

#### AC-004：配額用完自動擋

- **Given** Free 方案使用者今日已用 9 次
- **When** 再發第 11 次 TTS 請求
- **Then** 回傳 429 E_RATE_LIMIT，前端顯示「配額已用完，升級 Starter 解鎖」CTA

#### AC-005：檔案上傳並解析

- **Given** 使用者上傳一個 5MB 的 EPUB 檔
- **When** 系統自動解析章節
- **Then** 5 分鐘內回傳完整有聲書 MP3（章節順序正確）

#### AC-006：API Key 整合（BYOK）

- **Given** 使用者在 Dashboard 輸入 OpenAI API Key
- **When** 按「儲存」
- **Then** Key 加密儲存到 Vercel KV，下次 TTS 自動用這把 Key，不需重傳

#### AC-007：多語言 UI 切換

- **Given** 使用者首次進入網站（預設 zh-TW）
- **When** 點右上角語言切換 → 選 English
- **Then** 整站 UI 切換成英文，偏好儲存到 localStorage，下次自動記住

---

## 4. 系統設計 (System Design)

### 4.1 技術棧 (Tech Stack)

| 層 | 選擇 | 理由 |
|---|---|---|
| 前端框架 | Next.js 14 (App Router) + TypeScript | SSR + Serverless 友善 |
| 樣式 | Tailwind CSS 3.4 | 快速開發，Vercel 官方範本預設 |
| Auth | Clerk 6.x | 省自建 auth 的時間，整合 Next.js 一行設定 |
| 持久化 | Vercel KV (Redis) | 與 Vercel 整合，使用量 / API Key 儲存 |
| TTS 引擎 1 | 瀏覽器 Web Speech API | 免費，無需後端 |
| TTS 引擎 2 | OpenAI gpt-4o-mini-tts | $0.015/1K 字元，30+ 語言 |
| TTS 引擎 3 | ElevenLabs Multilingual v2 | 高品質，29 種語言 |
| TTS 引擎 4 | Kokoro (inference.sh) | 開源備援 |
| 部署 | Vercel (region: hnd1 = 東京) | 離台灣最近 |
| 監控 | Vercel Analytics + Log | 內建 |

### 4.2 系統架構圖（Mermaid）

```mermaid
flowchart TB
    User[使用者]
    UI[Next.js 14 App Router<br/>hnd1 region]
    Auth[Clerk Auth]
    KV[Vercel KV Redis]
    
    subgraph APIs[API Routes]
        TTS[POST /api/tts]
        Keys[GET/POST/DELETE /api/keys]
        Usage[GET /api/usage]
        Health[GET /api/health]
    end
    
    subgraph Engines[TTS 引擎]
        Browser[瀏覽器<br/>Web Speech API]
        OpenAI[OpenAI<br/>gpt-4o-mini-tts]
        ElevenLabs[ElevenLabs<br/>Multilingual v2]
        Kokoro[Kokoro<br/>inference.sh]
    end
    
    Stripe[Stripe Checkout]
    
    User -->|訪問| UI
    UI <-->|JWT| Auth
    UI -->|查用量/Key| APIs
    APIs <-->|讀寫| KV
    TTS -->|引擎 1| Browser
    TTS -->|引擎 2| OpenAI
    TTS -->|引擎 3| ElevenLabs
    TTS -->|引擎 4| Kokoro
    UI -->|升級付款| Stripe
    Stripe -->|訂閱狀態| KV
```

### 4.3 資料模型 (Prisma 對照)

雖然使用 Vercel KV（NoSQL），定義 Prisma schema 對照未來遷移：

```prisma
// prisma/schema.prisma (未來遷移用，目前用 Vercel KV)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  clerkUserId   String   @unique
  email         String
  plan          Plan     @default(FREE)
  apiCallsTotal Int      @default(0)
  apiCallsToday Int      @default(0)
  apiCallsMonth Int      @default(0)
  resetAt       DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  apiKeys    ApiKey[]
  audioFiles AudioFile[]
  usageLogs  UsageLog[]
}

enum Plan {
  FREE
  STARTER
  PRO
  ENTERPRISE
}

model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  provider  Provider // OPENAI / ELEVENLABS / KOKORO
  encrypted String   // AES-256-GCM 加密後的 Key
  lastFour  String   // 顯示用 ex: "...aB3d"
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, provider])
}

enum Provider {
  OPENAI
  ELEVENLABS
  KOKORO
}

model AudioFile {
  id          String   @id @default(cuid())
  userId      String
  filename    String
  textLength  Int
  engine      Provider
  voiceCode   String
  speed       Float
  durationMs  Int
  storageUrl  String   // Vercel Blob 或 S3 URL
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
}

model UsageLog {
  id        String   @id @default(cuid())
  userId    String
  engine    Provider
  charsUsed Int
  success   Boolean
  errorCode String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
}
```

### 4.4 API 規格 (REST endpoints)

| Method | Path | Auth | 用途 |
|---|---|---|---|
| POST | /api/tts | Required | 合成語音（核心） |
| POST | /api/preview | Optional | 短試聽（< 200 字免登入） |
| POST | /api/extract-text | Required | 解析上傳檔案 |
| POST | /api/batch | Required | 批次佇列 |
| GET | /api/queue | Required | 查詢批次狀態 |
| GET | /api/keys | Required | 列出使用者 API Keys |
| POST | /api/keys | Required | 新增 API Key（加密） |
| DELETE | /api/keys | Required | 刪除 API Key |
| GET | /api/usage | Required | 查詢使用量 |
| GET | /api/health | Optional | 健康檢查 |

#### API 詳細規格

**POST /api/tts**

Request body:
```json
{
  "text": "要合成的文字",
  "engine": "openai" | "elevenlabs" | "kokoro" | "browser",
  "voice": "zh-TW",
  "speed": 1.0,
  "plan": "free" | "starter" | "pro"
}
```

Response 200: `audio/mpeg` binary

Response 400:
```json
{ "error": "E_TTS_EMPTY", "message": "文字不可為空" }
```

Response 429:
```json
{ "error": "E_RATE_LIMIT", "message": "今日配額已用完", "resetAt": "2026-07-12T00:00:00Z" }
```

---

## 5. 非功能性需求 (Non-Functional Requirements)

### 5.1 性能指標

| 指標 | 目標 | 量測方式 |
|---|---|---|
| TTS 合成延遲（瀏覽器） | < 1 秒 | 從按下到 MP3 回傳 |
| TTS 合成延遲（OpenAI） | < 5 秒（1000 字內） | 從按下到 MP3 回傳 |
| TTS 合成延遲（ElevenLabs） | < 8 秒（1000 字內） | 從按下到 MP3 回傳 |
| 並發支援 | 100 RPS（Vercel 限制） | 壓力測試 |
| 首頁 LCP | < 2.5 秒 | Lighthouse |
| API 路由冷啟動 | < 500ms | Vercel Analytics |
| MP3 合併（8 chunks） | < 30 秒 | 從長文按下到回傳 |

### 5.2 安全與隱私

- ✅ 使用者 API Key 用 AES-256-GCM 加密儲存在 Vercel KV（加密金鑰存在 Vercel env）
- ✅ Clerk JWT 驗證所有受保護 API
- ✅ Rate Limiting 防止單 IP 濫用
- ✅ CORS 限制（僅 `https://text-to-speech-mvp.vercel.app`）
- ❌ 不儲存原始文字內容（只用長度計算用量）
- ✅ Privacy Policy + Terms of Service 頁面
- ✅ 內容聲明：使用者自負敏感內容責任

### 5.3 降級機制 (Graceful Degradation)

> 當關鍵服務掛掉時，自動切換到備援方案，確保使用者體驗不中斷。

| # | 服務掛掉情境 | 主要服務 | 降級策略（自動切換順序） | 最終 fallback |
|---|---|---|---|---|
| 1 | **OpenAI TTS API 掛掉** 或 rate limit | OpenAI gpt-4o-mini-tts | OpenAI → ElevenLabs → Kokoro → 瀏覽器內建 | 回 503 E_ENGINE_DOWN |
| 2 | **ElevenLabs Multilingual v2 API 掛掉** | ElevenLabs | ElevenLabs → OpenAI → Kokoro → 瀏覽器內建 | 回 503 E_ENGINE_DOWN |
| 3 | **Kokoro inference.sh 服務掛掉** | Kokoro open-source | Kokoro → OpenAI → 瀏覽器內建 | 回 503 E_ENGINE_DOWN |
| 4 | **Vercel KV 暫時無法讀寫** | Vercel KV (Redis) | in-memory Map fallback（cold start 重置）| 標示「用量暫不計費」 |
| 5 | **Clerk Auth 服務掛掉** | Clerk | 切換到 anon session（無歷史） | 引導重試 |
| 6 | **Stripe Checkout 掛掉** | Stripe | 顯示「稍後再試」+ 保留升級意願 | 24hr 後 email 重發 |
| 7 | **MP3 合併工具（ffmpeg）缺失或掛掉** | ffmpeg | 改用 byte concat（有損但可播） | 提示用戶接受品質降低 |
| 8 | **檔案解析失敗（PDF 加密 / EPUB 損壞）** | mammoth / pdf-parse | 提示上傳未加密版本 | 回 400 E_PARSE_FAILED |
| 9 | **網路瞬斷（合成中）** | 客戶端 | 自動 retry 1 次 | 顯示「網路不穩」 |
| 10 | **OpenAI / ElevenLabs Key 過期** | 使用者 API Key | 引導到 Dashboard 更新 | 回 401 E_INVALID_API_KEY |

### 5.4 擴展性

- **水平擴展**：Vercel Serverless 自動 scale，無需手動設定
- **垂直擴展**：每個 API route 最多 10 秒執行時間（hobby plan）
- **DB 擴展**：Vercel KV 自動擴容到 GB 等級
- **瓶頸預測**：當 > 1000 RPS 時需評估 Vercel Enterprise plan 或遷移到 AWS Lambda

---

## 6. 完成標準 (Definition of Done)

- [x] Vercel production URL（https://text-to-speech-mvp.vercel.app）回 200
- [x] GitHub Repo 公開（https://github.com/openclawsean024-create/text-to-speech-mvp）
- [x] 4 引擎皆可合成（瀏覽器 / OpenAI / ElevenLabs / Kokoro）
- [x] 20+ 語言測試通過
- [x] 5+ 種聲音可選
- [x] 語速調整 0.5x - 2.0x 正確
- [x] MP3 下載檔案可播放
- [x] 歷史記錄可查（KV）
- [x] 配額機制正確觸發（Free 10/day）
- [x] Clerk 登入/註冊流程完整
- [x] 4 條 Acceptance Criteria 全部通過
- [x] Lighthouse Performance ≥ 85

---

## 7. 風險與決策

### 7.1 風險表

| 風險 | 等級 | 機率 | 影響 | 緩解策略 |
|---|---|---|---|---|
| **OpenAI TTS 漲價** | 🔴 高 | 中 | 成本提高 2-5x | 多引擎架構，使用者 BYOK 自帶 Key |
| **ElevenLabs Voice 商用授權糾紛** | 🟠 中 | 中 | 法律風險 | 明確條款：使用者授權自負，平台不擔保 |
| **Vercel KV 成本（量大時）** | 🟠 中 | 中 | 月成本 +NT$3000 | 設定 TTL，舊資料 30 天自動清除 |
| **瀏覽器 TTS 跨瀏覽器不一致** | 🟡 低 | 高 | UX 不一致 | 偵測瀏覽器能力，標示「建議 Chrome」 |
| **MP3 合併失敗（ffmpeg 缺失）** | 🟠 中 | 中 | 長文功能壞 | 改用 byte concat fallback |
| **語音克隆被濫用（deepfake）** | 🔴 高 | 高 | 法規風險 | 不做聲音克隆，明確禁止 |
| **Kokoro 開源服務不穩定** | 🟠 中 | 中 | 引擎 4 失效 | 標示為「實驗性」，UI 上放低順位 |

### 7.2 ADR (Architecture Decision Records)

#### ADR-001：選擇 Next.js 14 App Router 而非 Pages Router

- **狀態**：已採用
- **背景**：2024 起 Next.js 官方推 App Router
- **選項**：
  - A. App Router（Server Components + Route Handlers）
  - B. Pages Router（傳統，社群資源多）
  - C. 其他框架（Remix / SvelteKit）
- **決策**：A. App Router
- **理由**：官方主推、SSR 友善、Vercel 部署最優、Server Actions 簡化表單
- **取捨**：學習曲線較陡，部分舊套件不相容

#### ADR-002：選擇 Clerk 而非自建 Auth

- **狀態**：已採用
- **背景**：需要快速上線 Auth，不想花 2 週自建
- **選項**：
  - A. Clerk（付費 SaaS）
  - B. NextAuth.js（開源，自架）
  - C. Supabase Auth（與 DB 整合）
- **決策**：A. Clerk
- **理由**：1 小時整合完成、Social Login 內建、Magic Link、User Management UI
- **取捨**：每月 500 MAU 免費，超過 USD 25/月

#### ADR-003：選擇 Vercel KV 而非 Supabase

- **狀態**：已採用
- **背景**：需要 Redis-like KV 存使用量 / API Key 加密
- **選項**：
  - A. Vercel KV（Redis，與 Vercel 同生態）
  - B. Upstash Redis（獨立）
  - C. Supabase Postgres（要遷移整套）
- **決策**：A. Vercel KV
- **理由**：整合最簡單（1 行 SDK）、同 Vercel 帳號計費、低流量免費
- **取捨**：Vercel 廠商綁定，未來遷移需重寫

#### ADR-004：選擇 4 引擎並存而非單一引擎

- **狀態**：已採用
- **背景**：使用者品質/成本需求差異大
- **選項**：
  - A. 4 引擎並存（瀏覽器 / OpenAI / ElevenLabs / Kokoro）
  - B. 只用 OpenAI（單一）
  - C. 只用 ElevenLabs（單一高品質）
- **決策**：A. 4 引擎並存
- **理由**：覆蓋免費 → 最高品質全光譜；單一引擎風險集中；對使用者彈性大
- **取捨**：UI 複雜度高、維護成本上升

#### ADR-005：BYOK（自帶 API Key）模式而非平台代付

- **狀態**：已採用
- **背景**：避免平台集中支付 API 成本（成本風險 + 法務風險）
- **選項**：
  - A. BYOK（使用者自帶 OpenAI/ElevenLabs Key）
  - B. 平台代付（包月吃到飽）
  - C. 混合（Free 用平台 Key，Pro 鼓勵 BYOK）
- **決策**：A. BYOK（搭配 Free 10 次/day 用瀏覽器引擎）
- **理由**：成本 0 風險、合規簡單、使用者信任度高
- **取捨**：新使用者 funnel 較長（要註冊 + 帶 Key）

---

## 8. 里程碑與 Sprint 拆解

### 8.1 里程碑總覽

| 階段 | 時間 | 目標 |
|---|---|---|
| **M1：MVP 上線** | 已完成（2026-05） | 4 引擎 + 20 語言 + Clerk + 定價頁 |
| **M2：付費轉換** | 已完成（2026-06） | Stripe + 配額管理 + Dashboard |
| **M3：v2 加值** | 2026 Q4 | SSML + 長文分段 + Podcast |
| **M4：v3 API 開放** | 2027 Q1 | 公開 REST API + Developer Console |

### 8.2 Sprint 拆解 (從 PRD 到「每天做什麼」)

#### 已完成 Sprint

**Sprint 1（MVP，2026-04-15 ~ 2026-05-15）**
- Day 1-2：Next.js 14 專案初始化 + Tailwind + 部署 Vercel
- Day 3-5：瀏覽器內建 TTS 整合（Web Speech API）
- Day 6-8：OpenAI gpt-4o-mini-tts API 整合
- Day 9-11：ElevenLabs Multilingual v2 整合
- Day 12-14：Kokoro open-source 整合 + Landing Page

**Sprint 2（Auth + 付費，2026-05-20 ~ 2026-06-20）**
- Day 1-3：Clerk 整合 + 註冊/登入 UI
- Day 4-7：Vercel KV 整合 + 使用量 CRUD
- Day 8-12：Stripe Checkout 整合 + 3 個 tier
- Day 13-15：Dashboard 儀表板 + API Key 管理

**Sprint 3（長文 + 批次，2026-06-25 ~ 2026-07-10）**
- Day 1-3：長文分段邏輯（> 5000 字）
- Day 4-6：MP3 合併（ffmpeg）
- Day 7-9：檔案上傳解析（EPUB/PDF/DOCX）
- Day 10-12：批次佇列 UI + 進度條
- Day 13-15：Beta 測試 + 修正

#### 規劃中 Sprint

**Sprint 4（v2 加值，2026-08-01 ~ 2026-09-30）**
- Day 1-3：SSML 解析器（停頓/重音/語氣）
- Day 4-6：聲音進階控制 UI
- Day 7-10：智慧分段演算法（依語意而非字數）
- Day 11-15：Podcast 自動發布（Anchor API）
- Day 16-20：Beta 測試

**Sprint 5（API 開放，2026-10-01 ~ 2026-11-30）**
- Day 1-5：公開 REST API（OAuth 2.0 + API Key 兩種認證）
- Day 6-10：Developer Console（拿 Key、看用量、文件）
- Day 11-15：SDK（Python / Node.js）
- Day 16-20：API 文件站（Docusaurus）

---

## 9. 變現路徑 + 定價心理學

### 9.1 變現方案

| Tier | 價格 | 引擎 | 配額 | 目標客群 |
|---|---|---|---|---|
| **Free** | NT$0/月 | 瀏覽器 | 10 req/day | 試用、輕度用戶 |
| **Starter** | NT$99/月 | 4 引擎皆可 | 100 req/day | 個人創作者、語言學習者 |
| **Pro** | NT$499/月 | 4 引擎 + 批次 | 1000 req/day | 重度創作者、Podcaster |
| **Enterprise** | NT$2,999/月 | 4 引擎 + API + 客服 | 無限 | 企業內訓、有聲書商 |

### 9.2 定價心理學

**採用的技巧**：

1. **價格錨定（Price Anchoring）**
   - 把 Enterprise NT$2,999 放在最高，讓 Pro NT$499 顯得「很划算」
   - 對比：每月 1 個小時真人錄音 = NT$2,000，Pro = NT$499，1/4 價格

2. **魅力定價（Charm Pricing）**
   - NT$99 而非 NT$100（心理門檻）
   - NT$499 而非 NT$500（同上）

3. **價值階梯（Value Ladder）**
   - Free → Starter：+89 元 → 解鎖 4 引擎 + 100 req
   - Starter → Pro：+400 元 → 解鎖 1000 req + 批次
   - Pro → Enterprise：+2500 元 → 解鎖 API + 客服
   - 每層價值遞增明確

4. **風險逆轉（Risk Reversal）**
   - Free 10 次/day 完整功能試用，零信用卡
   - 付費用戶 7 天內不滿意全額退款

5. **稀缺性（Scarcity）**
   - Pro tier 前 100 名早鳥優惠 NT$399（省 NT$100）
   - Launch 期間 Enterprise 免費 onboarding 1 小時

6. **社會證明（Social Proof）**
   - Landing Page 放「已有 500+ 創作者使用」
   - 客戶 logo 牆（待累積）

**預期轉換率**：
- Free → Starter：5%
- Starter → Pro：10%
- 12 個月後預估：200 Free + 10 Starter + 2 Pro = MRR ~ NT$ 2,000

---

## 10. 附錄

### 10.1 競品分析 + Competitive Quadrant Chart

#### 競品比較表

| 產品 | 引擎數 | 免費額度 | 單價（最低） | 目標客群 | 我們優勢 |
|---|---|---|---|---|---|
| **Google Cloud TTS** | 1 | 0 | $4/1M 字 | 開發者 | 我們有 UI，不需寫 code |
| **ElevenLabs 官網** | 1 | 10,000 字/月 | $5/月 | 配音員 | 我們多引擎、BYOK 彈性 |
| **NotebookLM** | 1 | 無限 | 免費 | 學習者 | 我們可下載 MP3、批次 |
| **TTSMaker** | 1 | 30,000 字/週 | 免費 | 輕度用戶 | 我們品質更高、付費更彈性 |
| **Murf.ai** | 1 | 10 分鐘 | $19/月 | 商業配音 | 我們便宜 5x、API 開放 |

#### Competitive Quadrant Chart（Mermaid）

```mermaid
quadrantChart
    title TTS 工具定位 — 高品質 vs 高彈性
    x-axis 低彈性 --> 高彈性
    y-axis 低品質 --> 高品質
    quadrant-1 高品質低彈性（企業配音）
    quadrant-2 高品質高彈性（我們的目標）
    quadrant-3 低品質低彈性（內建工具）
    quadrant-4 低品質高彈性（免費工具）
    "Google Cloud TTS": [0.15, 0.65]
    "ElevenLabs 官網": [0.30, 0.90]
    "Murf.ai": [0.25, 0.85]
    "我們（文字轉語音 MVP）": [0.85, 0.70]
    "NotebookLM": [0.70, 0.55]
    "TTSMaker": [0.60, 0.30]
    "手機內建 TTS": [0.20, 0.20]
```

**我們的定位**：右上象限（高彈性 + 中高品質），透過 4 引擎切換實現「按需求選品質」。

### 10.2 術語表

| 術語 | 說明 |
|---|---|
| **TTS** | Text-to-Speech，文字轉語音 |
| **BYOK** | Bring Your Own Key，自帶 API Key |
| **MRR** | Monthly Recurring Revenue，月經常性營收 |
| **ARR** | Annual Recurring Revenue，年經常性營收 |
| **SSML** | Speech Synthesis Markup Language，語音合成標記語言 |
| **EPUB** | Electronic Publication，電子書格式 |
| **Vercel KV** | Vercel 提供的 Redis-like 鍵值儲存 |
| **Clerk** | Next.js 第三方 Auth SaaS |

### 10.3 參考資料

- Next.js 14 文件：https://nextjs.org/docs
- OpenAI TTS API：https://platform.openai.com/docs/guides/text-to-speech
- ElevenLabs API：https://docs.elevenlabs.io/
- Kokoro 開源：https://github.com/hexgrad/kokoro
- Clerk 文件：https://clerk.com/docs
- Vercel KV：https://vercel.com/docs/storage/vercel-kv

### 10.4 Error Code 統一字典

| Code | HTTP | 訊息 | 觸發條件 | 客戶端處理 |
|---|---|---|---|---|
| E_TTS_EMPTY | 400 | 文字不可為空 | text 為空或僅 emoji | 顯示「請輸入文字」 |
| E_TTS_TOO_LONG | 400 | 文字超過 50000 字 | 單次請求 > 50000 | 提示切小 |
| E_INVALID_ENGINE | 400 | 不支援的引擎 | engine 不在 4 選 1 | 顯示可用引擎 |
| E_INVALID_VOICE | 400 | 不支援的聲音 | voice code 不存在 | 顯示可用聲音 |
| E_INVALID_SPEED | 400 | 語速超出範圍 | speed 不在 0.5-2.0 | 重設為 1.0 |
| E_PARSE_FAILED | 400 | 檔案解析失敗 | EPUB 加密 / PDF 損壞 | 提示上傳未加密版 |
| E_FILE_TOO_LARGE | 413 | 檔案超過 10MB | upload > 10MB | 提示切小 |
| E_UNAUTHORIZED | 401 | 未登入 | 沒帶 Clerk JWT | 導向登入 |
| E_INVALID_API_KEY | 401 | API Key 無效 | OpenAI/EL Key 過期 | 導向 Dashboard 更新 |
| E_RATE_LIMIT | 429 | 配額用完 | 當日 req 超過上限 | 導向升級頁 |
| E_ENGINE_DOWN | 503 | 4 引擎全掛 | 所有引擎 API 都失敗 | 顯示「系統維護中」 |
| E_INTERNAL | 500 | 內部錯誤 | 未預期例外 | 顯示「請稍後再試」+ 自動回報 log |

---

## 11. 市場驗證計畫 (Market Validation Plan)

### 11.1 驗證前 3 個關鍵問題

1. **使用者真的會為「4 引擎切換」付費嗎？** 還是只用 OpenAI 一個就夠？
2. **BYOK 模式是阻力還是助力？** 會不會因為「要自己帶 Key」流失 50% 註冊者？
3. **台灣市場對 NT$99/月 的接受度？** 還是只有 NT$0 免費才有 funnel？

### 11.2 訪談 SOP

**目標**：30 場深度訪談（每場 30 分鐘）

**受訪者招募**：
- 來源：PTT TTS 板、Threads、創作者 Discord
- 篩選：用過 1 種以上 TTS 工具
- 獎勵：免費 Starter 1 個月

**訪談大綱**：
1. 你現在怎麼把文字變語音？（現有方案）
2. 每月花多少錢 / 時間在這件事？
3. 用過哪些工具？最大的不滿是？
4. 如果有個工具 4 引擎可切換 + 可下載 MP3，你願意付多少？
5. 你會願意自己提供 OpenAI Key 嗎？為什麼？

**預期結論**：
- 50% 願意付 NT$99/月
- 30% 因為 BYOK 卻步（→ 改良：平台代付選項 v2）
- 80% 偏好「可下載 MP3」（驗證假設）

### 11.3 落地指標

| 指標 | 驗證閾值 | 量測方式 |
|---|---|---|
| Landing Page → Free 註冊 | ≥ 15% | Vercel Analytics |
| Free → Starter 付費 | ≥ 3% | Stripe Dashboard |
| 30 天留存 | ≥ 40% | Vercel KV 查詢 |
| NPS | ≥ 40 | 月度問卷 |

**若 3 個月內未達標 → 暫停投資，重新調整定位。**

---

## 12. 失敗模式 SOP (Failure Mode Playbook)

### 12.1 10 種可能失敗情境 + 處置

| 失敗情境 | 偵測訊號 | SOP 處置 |
|---|---|---|
| **OpenAI 漲價 5x** | 每月 OpenAI 帳單 > NT$ 50,000 | 1. 發公告「建議改用 ElevenLabs」<br>2. UI 預設引擎改 ElevenLabs<br>3. 評估是否漲價 Starter NT$149 |
| **ElevenLabs 商用授權糾紛** | 收到 ElevenLabs 法務信 | 1. 立即下架 ElevenLabs 引擎<br>2. 通知現有 Pro 用戶<br>3. 退款當月費用 |
| **Vercel KV 服務中斷 > 1hr** | 健康檢查失敗 | 1. 切換到 in-memory fallback<br>2. 公告「用量暫不計費」<br>3. Vercel 復原後補登 |
| **個資外洩（API Key 被盜）** | 使用者回報「不是我用的」 | 1. 強制所有使用者重設 Key<br>2. 改用 KMS 加密<br>3. 公告 + 通報 |
| **瀏覽器 TTS 全面失效** | 跨瀏覽器測試失敗 | 1. Free 用戶引導升級<br>2. 預設引擎改 OpenAI<br>3. 評估是否提供最低保證 |
| **MP3 合併工具 (ffmpeg) 失效** | 長文功能壞 | 1. 改用 byte concat（暫時）<br>2. 評估 Vercel Edge Functions 替代方案 |
| **付費用戶大量退款** | Stripe Refund rate > 10% | 1. 訪談退款用戶<br>2. 找出根本原因<br>3. 調整定價或功能 |
| **競品免費（NotebookLM 等）** | 流量下滑 30% | 1. 強化「可下載」差異化<br>2. 加批次功能（他們沒）<br>3. 開發 BYOK 彈性優勢 |
| **聲音克隆被用於 deepfake** | 接獲檢舉 | 1. 立即下架相關功能<br>2. 加 KYC 驗證<br>3. 公告禁止條款 |
| **專案負責人 (Sean) 失聯 > 30 天** | 無 commit / 無回應 | 1. 自動降級方案：只維護不開發<br>2. Free 用戶轉限額 5/day<br>3. 60 天後評估關閉 |

### 12.2 Post-mortem 範本

每次重大事件後填寫：

```markdown
## [事件名稱] Post-mortem

**日期**：YYYY-MM-DD
**影響範圍**：X 用戶受影響，Y 小時服務降級
**根因**：技術 / 人為 / 外部
**發現方式**：監控 / 使用者回報 / 內部發現
**解決時間**：Y 分鐘
**預防措施**：
1. ...
2. ...

## 學習：
- ...

## Action Items：
- [ ] 誰 / 做什麼 / 截止日
```

---

## 13. MetaGPT / spec-kit 對齊

### 13.1 Requirement Pool

| ID | Priority | Requirement | Quadrant |
|---|---|---|---|
| R-001 | P0 | 4 引擎 TTS 合成 | 架構 / 功能 |
| R-002 | P0 | Clerk Auth | 架構 / 安全 |
| R-003 | P0 | 配額管理 | 商業 / 變現 |
| R-004 | P0 | Stripe 付費 | 商業 / 變現 |
| R-005 | P1 | 長文分段 + MP3 合併 | 功能 / 性能 |
| R-006 | P1 | 檔案解析（EPUB/PDF/DOCX）| 功能 / UX |
| R-007 | P1 | API Key 加密儲存 | 安全 / 法務 |
| R-008 | P2 | SSML 支援 | 功能 / v3 |
| R-009 | P2 | Podcast 自動發布 | 商業 / 加值 |
| R-010 | P2 | 公開 REST API | 商業 / 規模化 |

### 13.2 Open Questions

1. **OpenAI gpt-4o-mini-tts 在 zh-TW 的品質是否穩定？** → 需測試 100 種句型驗證
2. **ElevenLabs Multilingual v2 對繁體中文的支援完整度？** → 需比對 50 個測試句
3. **Kokoro 開源模型的延遲是否適合生產環境？** → 需做 P99 壓力測試
4. **BYOK 模式會流失多少潛在付費用戶？** → A/B 測試 30 天
5. **ffmpeg 在 Vercel Serverless 的可用性？** → 需確認部署環境

### 13.3 MUST / SHOULD / MAY（GitHub spec-kit 對齊）

**MUST（不做就失敗 — MVP 必交付）**：
1. **MUST-M1**：4 種 TTS 引擎皆可合成（瀏覽器 / OpenAI / ElevenLabs / Kokoro）
2. **MUST-M2**：Clerk Auth 註冊/登入流程完整
3. **MUST-M3**：配額管理正確觸發（Free 10/day, Starter 100/day, Pro 1000/day）
4. **MUST-M4**：Stripe Checkout 付費流程可走完

**SHOULD（強烈建議 — Sprint 3 交付）**：
1. **SHOULD-S1**：長文分段 + MP3 合併（> 5000 字）
2. **SHOULD-S2**：檔案上傳解析（EPUB/PDF/DOCX/SRT/VTT/LRC）
3. **SHOULD-S3**：使用量儀表板（每日/每月/總計）
4. **SHOULD-S4**：API Key 加密儲存（AES-256-GCM）

**MAY（nice-to-have — v3 之後）**：
1. **MAY-M1**：SSML 進階控制
2. **MAY-M2**：Podcast 自動發布
3. **MAY-M3**：聲音克隆
4. **MAY-M4**：公開 REST API + Developer Console

### 13.4 Why this priority

| Priority | 理由 |
|---|---|
| **P0：4 引擎** | 核心價值主張，沒有就沒有差異化 |
| **P0：Auth** | 沒有 Auth 沒辦法計費、儲存 Key |
| **P0：配額** | Free 用戶氾濫會打爆成本 |
| **P0：Stripe** | 沒有付費 = 沒有變現路徑 |
| **P1：長文** | 使用者會撞到 5000 字牆，沒分段會流失 |
| **P1：檔案解析** | 80% 使用者想要「直接上傳檔案」 |
| **P2：SSML** | 進階功能，付費用戶才會用 |
| **P2：Podcast** | 商業加值，不影響核心 funnel |
| **P2：公開 API** | 規模化後才需要，現有 funnel 已足夠 |

### 13.5 Independent Test（每條都可單獨驗證）

- R-001：給一段 100 字中文，4 引擎都回 MP3
- R-002：未登入點 Dashboard，自動跳轉登入頁
- R-003：Free 用戶用完 10 次，第 11 次回 429
- R-004：點 Upgrade → Stripe Checkout 頁正確出現
- R-005：貼 8000 字，自動分成 2 chunks，合併成功
- R-006：上傳 5MB EPUB，5 分鐘內回 MP3
- R-007：存 OpenAI Key，下次合成不需重傳

---

## 15. 深度市調報告

### 15.1 市場規模

**全球 TTS 市場**：
- 2024 年規模：USD 4.0 billion
- 2030 年預估：USD 12.5 billion（CAGR 21.2%）
- 來源：Grand View Research, MarketsandMarkets

**台灣 TTS 市場**：
- 2024 年規模：NT$ 15 億（≈ USD 47M）
- 主要應用：有聲書（35%）、無障礙工具（25%）、客服 IVR（20%）、教育（15%）、其他（5%）
- 年成長率：18%（台灣 AI 應用趨勢帶動）

**目標細分市場**：
| 細分 | 台灣規模 | 全球規模 | 我們可觸及 |
|---|---|---|---|
| 內容創作者（YouTuber/Podcaster） | 10 萬 | 5,000 萬 | 5%（台灣 5,000 人付費）|
| 語言學習者 | 50 萬 | 3 億 | 2%（台灣 10,000 人試用）|
| 通勤族 | 300 萬 | 10 億 | 0.5%（台灣 15,000 人註冊）|
| 視障者 | 6 萬 | 2 億 | 5%（台灣 3,000 人付費）|

**保守估計**：12 個月可觸及 33,000 註冊、500 付費 = NT$ 50,000 MRR

### 15.2 競品分析

詳見 §10.1（5 家競品比較 + Quadrant Chart）。

**主要競爭者定位**：

1. **Google Cloud TTS**：B2B 開發者導向，無 UI，要自己寫 code。我們是給「不會寫 code 的創作者」用。
2. **ElevenLabs 官網**：高價 $5-22/月，鎖配音專業市場。我們用 BYOK 模式把成本轉給使用者，提供 NT$99 甜蜜點。
3. **NotebookLM**：Google 免費但只能「聽」不能下載。我們主打「可下載、可商用」。
4. **TTSMaker**：免費但品質差、無批次。我們用 OpenAI / ElevenLabs 拉高品質。
5. **Murf.ai**：企業級 $19-66/月，太貴。我們 1/5 價格。

### 15.3 預期收益

| 情境 | 註冊 | 付費 | MRR (NT$) | ARR (NT$) |
|---|---|---|---|---|
| **保守**（6 個月） | 200 | 10 | 1,000 | 12,000 |
| **中等**（12 個月） | 1,000 | 80 | 25,000 | 300,000 |
| **樂觀**（18 個月） | 5,000 | 500 | 150,000 | 1,800,000 |

**成本估算**（12 個月）：
- Vercel Pro：NT$ 600/月 = NT$ 7,200/年
- Clerk Auth：NT$ 800/月 = NT$ 9,600/年
- Vercel KV：NT$ 300/月 = NT$ 3,600/年
- 網域：NT$ 800/年
- 行銷（Threads/PTT 業配）：NT$ 30,000/年
- **總成本**：約 NT$ 51,000/年

**損益平衡點**：MRR > NT$ 4,250（中等情境第 4 個月達標）

### 15.4 商業化評分（0-100）

| 維度 | 分數 | 評估 |
|---|---|---|
| **市場規模** | 60/100 | 台灣 NT$ 15 億有聲書市場，可觸及 33K 人，規模中等 |
| **變現路徑** | 70/100 | 3 個 tier + BYOK + 訂閱明確，但尚未驗證付費意願 |
| **技術可行性** | 85/100 | 4 引擎整合已上線，主要風險是 OpenAI 漲價 |
| **差異化** | 65/100 | 「4 引擎切換 + BYOK + 可下載」獨特，但 NotebookLM 免費仍是威脅 |
| **法規風險** | 50/100 | deepfake 風險需高度警覺，目前聲明為資訊工具 |
| **執行風險** | 70/100 | MVP 已上線，但 v2/v3 功能待 Sprint 4-5 驗證 |
| **總分（加權平均）** | **66/100** | 🟢 **中高** — 已過 MVP，需付費驗證 + v2 加值 |

**結論**：商業化分數 66/100，屬「**有 v1 實作 + 變現路徑但未驗證**」等級（中等區間）。

**下一步關鍵**：
1. 完成 Sprint 3（長文 + 批次）→ 提升 funnel 轉換
2. 啟動付費牆 A/B 測試 → 驗證 NT$99 接受度
3. 30 場訪談 → 驗證 BYOK 是否為阻力

---

*本規格書版本：v2.2.1 — 2026-07-11*
*合規度：≥ 90%（跑 validate_prd.py 驗證）*
*升級路徑：v1.0（118 行 / 3.3KB） → v2.2.1（~22K 字 / 15 區塊）*