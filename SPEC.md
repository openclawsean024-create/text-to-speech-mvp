# 文字轉語音 v2.0 — 產品規格書

> 版本：2.0 | 最後更新：2026-04-30 | 維護者：Alan

---

## 1. 產品概述

### 1.1 產品名稱
**文字轉語音 v2.0** — 多引擎 AI TTS 服務

### 1.2 產品定位
一個支援多引擎（OpenAI gpt-4o-mini-tts、ElevenLabs Multilingual v2、Kokoro/inference.sh）的 AI 文字轉語音 SaaS 平台，讓用戶能夠將文字、電子書、字幕檔案轉換為自然語音音訊。

### 1.3 核心價值
- **多引擎支援**：同時支援三個主流 TTS 引擎
- **電子書轉換**：直接上傳 EPUB、PDF、DOCX，無需手動複製文字
- **批次處理**：支援最多 10 個任務的批量轉換
- **語音比較**：獨特的語音 A/B 比較功能

---

## 2. 功能規格

### 2.1 主要功能

#### 轉換模式
| 模式 | 說明 | 費用 |
|------|------|------|
| 瀏覽器模式 | 使用瀏覽器內建 SpeechSynthesis API，無需 API Key | 免費 |
| API 模式 | 使用 OpenAI / ElevenLabs / Kokoro，需 API Key | 按用量計費 |

#### 支援引擎
| 引擎 | 模型 | 語言支援 | 語速調整 |
|------|------|---------|---------|
| OpenAI | gpt-4o-mini-tts | 30+ | 0.25x - 4.0x |
| ElevenLabs | Multilingual v2 | 30+ | 0.5x - 1.5x |
| Kokoro | inference.sh | 多語言 | 0.5x - 2.0x |

#### 語音預設
| ID | 名稱 | 性別 | 年齡 | 語言 | OpenAI Voice |
|----|------|------|------|------|-------------|
| male-adult-onyx | 深沉大叔 | 男 | 成人 | 多語言 | onyx |
| male-young-echo | 陽光男孩 | 男 | 年輕 | 多語言 | echo |
| male-deep-fable | 磁音低音 | 男 | 成人 | 英文 | fable |
| female-adult-nova | 知性姐姐 | 女 | 成人 | 多語言 | nova |
| female-young-shimmer | 甜心少女 | 女 | 年輕 | 多語言 | shimmer |
| female-warm-alloy | 溫暖阿姨 | 女 | 成人 | 多語言 | alloy |
| teen-male-onyx | 少年正太 | 男 | 青少年 | 中文 | onyx |
| teen-female-nova | 少女清脆 | 女 | 青少年 | 中文 | nova |
| multi-en-fable | English Native | 男 | 成人 | 英文 | fable |
| multi-ja-alloy | 日本語女性 | 女 | 成人 | 日文 | alloy |
| multi-ko-shimmer | 한국어 여성 | 女 | 成人 | 韓文 | shimmer |
| multi-zh-nova | 中文普通話 | 女 | 成人 | 中文 | nova |

#### 檔案格式支援
| 格式 | 最大大小 | 說明 |
|------|---------|------|
| .txt | 50MB | 純文字 |
| .srt | 50MB | 字幕檔 |
| .vtt | 50MB | WebVTT 字幕 |
| .lrc | 50MB | 歌詞檔 |
| .epub | 50MB | 電子書 |
| .pdf | 50MB | PDF 文件 |
| .docx | 50MB | Word 文件 |

#### 文字限制
- 單次轉換：最多 **10,000 字**
- 超過 5,000 字自動拆分多個片段處理
- 批次佇列：最多 **10 個任務**

#### 輸出格式
- **MP3**：96kbps，適合網頁/社群分享
- **WAV**：44.1kHz 16-bit 立體聲，適合後續音頻編輯

### 2.2 訂閱方案

| 方案 | 價格 | 每日限制 | 引擎 | 商業授權 |
|------|------|---------|------|---------|
| Free | NT$0（永久） | 10 次 | 僅瀏覽器 | ✗ |
| Starter | NT$199/月 | 100 次 | 全部 | ✓ |
| Pro | NT$599/月 | 1,000 次 | 全部 | ✓ |

**用量重置**：每日午夜 UTC

### 2.3 使用者流程

#### 未登入用戶
1. 訪問首頁 → 使用瀏覽器模式（免費，無需登入）
2. 或點擊「登入」→ Clerk 登入/註冊
3. 登入後進入 API 模式，需設定 API Key

#### 已登入用戶
1. 訪問控制台 → 儲存 API Key
2. 選擇方案（控制台本地切換）
3. 開始轉換 → 系統記錄用量

---

## 3. 技術架構

### 3.1 前端
- **框架**：Next.js 14 (App Router)
- **UI**：Tailwind CSS + 自定義 CSS 變數
- **認證**：Clerk Authentication
- **圖標**：Lucide React

### 3.2 後端 API

#### 端點列表
| Method | 路徑 | 說明 | 認證 |
|--------|------|------|------|
| POST | `/api/tts` | 單一文字轉語音 | 可選 |
| POST | `/api/batch` | 批次轉換 | 可選 |
| POST | `/api/extract-text` | 檔案文字提取 | - |
| GET | `/api/usage` | 使用量查詢 | 必需 |
| PUT | `/api/keys` | 儲存 API Key | 必需 |
| DELETE | `/api/keys` | 刪除 API Key | 必需 |
| GET | `/api/health` | 健康檢查 | - |

#### 文字分段邏輯
- 段落優先分段（保持語義完整性）
- 每段最多 5,000 字
- 超長段落按句子邊界分割

#### API Key 優先順序
1. `body.apiKey`（直接傳入，最優先）
2. 用戶儲存的 Key（資料庫）
3. 環境變數 `${ENGINE}_API_KEY`

### 3.3 資料儲存
- **Vercel KV (Upstash)**：API Keys、使用量計數
- **本地記憶體**：開發環境 fallback（cold start 會重置）
- **localStorage**：使用者偏好設定、佇列狀態

### 3.4 環境變數
```
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# TTS Engine API Keys
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
KOKORO_API_KEY=...
KOKORO_API_URL=https://api.inference.sh
KOKORO_APP_ID=kokoro

# Vercel KV (optional — graceful fallback to in-memory)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

---

## 4. 付費牆邏輯

### 4.1 額度檢查時機
- 用戶發起 `/api/tts` 或 `/api/batch` 請求時
- `checkRateLimit()` 查詢當日用量 vs 方案限制

### 4.2 方案切換
- 控制台內本地切換（localStorage）
- 未來：對接 Stripe Billing 實現真實訂閱

### 4.3 超額處理
| 情況 | HTTP 狀態 | 錯誤碼 | 訊息 |
|------|----------|--------|------|
| 額度用盡 | 429 | RATE_LIMIT_EXCEEDED | 當日用量已達上限 |
| API Key 無效 | 401 | INVALID_API_KEY | API Key 無效 |
| 上游超額 | 429 | UPSTREAM_RATE_LIMIT | 上游 API 額度超標 |
| 配額耗盡 | 402 | QUOTA_EXCEEDED | Provider 帳戶配額不足 |

---

## 5. 已知限制

1. **無真實付款整合**：目前方案切換為本地設定，尚未串接 Stripe/Clerk Billing
2. **瀏覽器模式無下載**：瀏覽器 SpeechSynthesis API 不支援音訊匯出
3. **Vercel KV 需付費**：使用 Upstash Redis，Vercel Hobby 計劃有連線數限制
4. **批次處理無 API Key 設定**：批次模式目前使用預設引擎，無法個別指定 API Key

---

## 6. 部署

### 6.1 GitHub
`https://github.com/openclawsean024-create/text-to-speech-mvp`

### 6.2 Vercel
`https://text-to-speech-mvp.vercel.app`

### 6.3 環境設定
```bash
# 複製專案
git clone https://github.com/openclawsean024-create/text-to-speech-mvp.git
cd text-to-speech-mvp

# 安裝依賴
npm install

# 複製環境變數
cp .env.example .env.local
# 填入實際的 API Keys

# 本地開發
npm run dev
```

---

## 7. 版本歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 1.0 | 2025-Q3 | 初始版本，單一引擎支援 |
| 2.0 | 2026-Q2 | 多引擎支援、Clerk 認證、批次處理、產品化 |
| 3.0 (進行中) | 2026-Q2 | 付費牆、API 完善、UX 優化 |
