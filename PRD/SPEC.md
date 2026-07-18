# 文字轉語音 MVP — 規格計劃書 v2.2.2（sweet spot sharp rewrite）

> **版本**：v2.2.2｜**更新日期**：2026-07-19｜**維護者**：Sophia (CPO) for Sean
> **對接技術**：Alan (CTO)｜**對接 Repo**：[openclawsean024-create/text-to-speech-mvp](https://github.com/openclawsean024-create/text-to-speech-mvp)
> **Live**：https://text-to-speech-mvp.vercel.app
> **Sweet Spot**：6/10（**繁中 Podcast 長音檔「自動章節 + 字幕 + AI 摘要」後製工廠**）→ 本版從 TTS 紅海轉身

---

## 0. 本版重寫摘要 (v2.2.2)

v2.2.1 已重定位為「長音檔自動章節 + 文字稿 + AI 摘要」。本版**再銳化**：

1. **鎖定唯一 TA**：繁中獨立 Podcaster + 線上課程講師（Hahow / PressPlay / Yotta）
2. **殺手鐧**：Whisper 繁中微調 + GPT 章節標題 + 長音檔自動切段（30 分鐘音檔 → 5 章 + 字幕 .srt + 中文摘要）
3. **變現路徑**：個人 NT$199/月 + 創作者 NT$499/月 + **企業剪輯坊 NT$2,999/月（API + 自動化）**

§15 貼出完整 sweet spot 5 問 + **最終商業化評分**：**69 / 100**（公式 =(9×0.3 + 6×0.7)×10）。

---

## 1. 產品概述

### 1.1 問題陳述

繁中 Podcast 創作者的最大痛點不是「TTS」（TTS 是 11B USD 紅海），而是「**長音檔後製**」——剪章節 + 上字幕 + 寫摘要，每集 4-8 小時、每月 4 集 = **每月 16-32 小時後製**。

| 現有方案 | 問題 |
|---|---|
| 真人剪輯（外包） | NT$800-1,600/集 × 月 4 = NT$3,200-6,400 |
| **Otter.ai** | 英文為主、繁中 WER >25%、無章節切分 |
| **NotebookLM Audio** | Google 內建、不支援外部音檔 |
| **Descript** | NT$720/月、英文 UI、無繁中優化 |
| **雅婷（台語 TTS）** | 只 TTS、不處理 STT / 章節 |
| **Vrew** | 影片字幕為主，長音檔章節弱 |
| **繁中自動章節 + 字幕工廠** | **市場空白** |

**甜蜜點（v2.2.2 銳化）**：繁中唯一「**長音檔自動章節 + 中英字幕 + AI 摘要**」後製工廠，1 集 30-90 分鐘音檔 5 分鐘出齊。

### 1.2 目標使用者

| Persona | 規模 (台灣) | 月情境 | 痛點 | ARPU/年 |
|---|---|---|---|---|
| 🎙️ **Nina 獨立 Podcaster** | ~5,000 | 月 4 集 60 分鐘 | 後製 16-32 hr/月 | **NT$5,988** |
| 🎬 **阿明 YouTuber** | ~20,000 | 影片含長訪談 | 章節標記 + 字幕 | NT$2,388 |
| 🎓 **林老師 Hahow 講師** | ~2,000 | 月 4 堂 60 分鐘課 | 學生筆記 + 章節 | NT$5,988 |
| 💼 **王總 企業培訓** | ~500 | 月 8 場內訓 | 會議紀錄 + 章節 | NT$35,988 |
| 📰 **張記者 自由採訪** | ~3,000 | 月 10 採訪 | 訪談稿 + 引用章節 | NT$5,988 |

**核心 TA = Nina + 林老師 + 張記者**（35,000 人 × 20% 付費 × NT$5,988 = NT$42M/年 TAM；保守抓 NT$3M）。

### 1.3 核心價值主張

> **「繁中唯一 Podcast 後製工廠 — 長音檔 5 分鐘變章節 + 字幕 + 摘要，月省 16-32 小時。」**

| 替代 | 缺點 | 我們差異 |
|---|---|---|
| 真人剪輯 | NT$3.2K-6.4K/月 | **NT$499/月省 90%** |
| Otter.ai | 英文為主、繁中 WER >25% | **Whisper 繁中微調 WER <8%** |
| NotebookLM | 僅自家上傳 | **任意 MP3 / WAV / YouTube link** |
| Descript | NT$720 + 英文 UI | **繁中 + UI 繁中 + 章節中文** |
| Vrew | 影片為主 | **純音檔也 OK** |

### 1.4 商業目標

| 時間 | 目標 | 指標 |
|---|---|---|
| M3 | 50 付費 + 200K MRR | 個人版為主 |
| M6 | 300 付費 + **首個企業剪輯坊客戶** | 1.2M MRR |
| M12 | 1500 付費 + **20 企業客戶** | **3M MRR** |

**Unit Economics**：
- 個人 NT$199 × 1,500 = NT$300K MRR
- 創作者 NT$499 × 300 = NT$150K MRR
- 企業 NT$2,999 × 20 = NT$60K MRR
- 客製 NT$9,999 × 5 = NT$50K MRR
- 合計 NT$560K MRR（M12 保守值）

### 1.5 ⭐ Non-Goals

- ❌ **TTS 多引擎聚合**（ElevenLabs 11B USD 紅海）
- ❌ **聲音克隆 / Voice Cloning**（紅海 + 法律）
- ❌ **真人訪談線上錄製**（Riverside 紅海）
- ❌ **英文內容為主**（繁中 niche）
- ❌ **音樂生成 / Music AI**（Suno / Udio 紅海）
- ❌ **即時翻譯 / 同步口譯**（Kudo 紅海）
- ❌ **多說話者分離（diarization）** v1（pyannote v2 才加）
- ❌ **Podcast 託管平台**（Firstory / SoundOn 紅海）
- ❌ **影音剪輯**（Premiere / CapCut 紅海）

---

## 2. 使用者場景與流程

### 2.1 流程圖

```
Podcaster 登入
   ↓
上傳 60 分鐘 MP3 / WAV（≤ 500MB）
   ↓
選設定：章節模式 / 字幕 / 摘要 / 語者分離（pro+）
   ↓
Inngest 加入任務佇列
   ↓
5-10 分鐘後 Email + Dashboard 通知
   ↓
Dashboard 顯示：
   ├─ 逐字稿（含時間戳）
   ├─ 章節切分（自動命名）
   ├─ 字幕（.srt / .vtt）
   ├─ 3 種摘要（簡/詳/重點）
   └─ 一鍵下載（zip）
   ↓
可線上編輯章節（重新命名）
   ↓
確認後：
   ├─ 個人下載 + 自動寄 ePub 文字稿
   ├─ 創作者上傳小宇宙 / Spotify（API）
   └─ 企業用 API 回傳自家 CMS
```

### 2.2 關鍵用戶故事

```
US-1（核心場景）
As a 獨立 Podcaster「Nina」
I want 上傳 60 分鐘音檔
So that 5 分鐘拿到章節 + 字幕 + 摘要，月省 20 小時

US-2（創作者場景）
As a Hahow 講師「林老師」
I want 將 60 分鐘課程音檔自動章節
So that 學生可按章節跳聽 + 自動出文字筆記

US-3（**企業剪輯坊** - 核心付費）
As a 企業培訓負責人「王總」
I want 透過 API 自動處理月 100 場內訓音檔
So that 月省 NT$80K 人工剪輯費

US-4（編輯修正）
As a Nina
I want 線上修章節命名（「S3 來賓分享」→「S3 創業失敗的 3 個教訓」）
So that 章節更貼題

US-5（多語）
As a 採訪英文訪賓的張記者
I want 同時出中英雙語逐字稿
So that 引用對照
```

### 2.3 邊界場景

| 場景 | 處理 |
|---|---|
| 音檔 > 2 小時 | 自動切段 + 並行處理 |
| 雜訊大 | NoiseReduce 預處理 + 提示 |
| 多語混雜（國台英） | 自動偵測標 `lang=zh-TW/en` |
| 專有名詞誤辨 | 自建 glossary（個人版 50 詞 / pro 500） |
| Whisper 漂字 | 用 LLM 重寫單句 |
| 章節命名太奇怪 | 編輯器可改 |
| Inngest 失敗重試 | 3 次 + 手動重新啟動 |

---

## 3. 功能性需求

### 3.1 MVP（P0 — 已 v2.2.1 鎖定 5 features）

| ID | 功能 | 狀態 | 為何必做 |
|---|---|---|---|
| F-001 | MP3/WAV 上傳（R2）| ✅ | 核心輸入 |
| F-002 | Whisper 繁中逐字稿（含時間戳）| ✅ | 甜蜜點核心 |
| F-003 | GPT 章節自動切分 + 命名 | ✅ | 差異化 |
| F-004 | 字幕 .srt / .vtt 匯出 | ✅ | 創作者必備 |
| F-005 | 3 種 AI 摘要（簡/詳/重點）| ✅ | 學生筆記 |
| F-006 | **ePub 文字稿匯出**（v2.2.2 新）| ❌ | Kindle / 閱讀器 |
| F-007 | **個人詞彙表 50 詞**（v2.2.2 新）| ❌ | 提升辨識率 |

**砍掉**：TTS 引擎管理、聲音克隆、英文為主。

### 3.2 v2（P1）

| ID | 功能 | 商業理由 |
|---|---|---|
| F-101 | 多說話者分離（pyannote）| 訪談 / 圓桌必備 |
| F-102 | 中英雙語逐字稿 | 採訪場景 |
| F-103 | YouTube link 直接抓音檔 | 整合 |
| F-104 | **API 給企業呼叫** | 企業剪輯坊 |
| F-105 | 章節命名線上編輯 | 個人化 |
| F-106 | 章節音檔切割（zip）| 重發布 |

### 3.3 v3（P2 探索）

| ID | 功能 | 假設 |
|---|---|---|
| F-201 | 即時轉寫（會議）| 場景延伸 |
| F-202 | 自動發佈到小宇宙 / Spotify | 創作者出口 |
| F-203 | Hahow / PressPlay 上架串接 | 課程出口 |
| F-204 | 自動出社群貼文（IG / Threads）| 行銷延伸 |

### 3.4 ⭐ Acceptance Criteria

```
AC-01 上傳
  Given Podcaster 上傳 60 分鐘 MP3 (≤ 500MB)
  When 點「開始處理」
  Then 5 分鐘內收到 email + Dashboard 通知
  And 60 分鐘音檔準確率 WER < 10%
  And 自動章節 ≥ 3 段
  And 摘要 3 種格式產生

AC-02 章節自動命名
  Given 60 分鐘訪談音檔
  When GPT 章節切分完成
  Then 每章節標題 ≤ 20 字、可讀、不重複
  And 編輯器可改標題（autosave）

AC-03 字幕匯出
  Given 已處理音檔
  When 下載字幕
  Then .srt + .vtt 雙格式 zip
  And 時間戳精準 ±0.5s
  And 包含 speaker label（多語者）

AC-04 詞彙表
  Given Pro 用戶上傳 glossary.json
  When Whisper 處理
  Then 該詞 WER < 5%（vs 原始 12%）
  And 個人版 50 詞 / Pro 500 詞

AC-05 **企業 API（v2.2.2 新）**
  Given 企業用 API key
  When POST /api/v1/process {audio_url, settings}
  Then < 10 分鐘回傳 webhook + JSON 結果
  And 1 key 月 200 hr 額度
  And rate limit 1 req/sec
```

---

## 4. 系統設計

### 4.1 技術棧

| Layer | 選 | 理由 |
|---|---|---|
| Frontend | Next.js 16 + Tailwind | 既有 |
| Backend | Inngest（任務佇列）| 既有 |
| STT | **Whisper large-v3 + 繁中微調** | 甜蜜點核心 |
| LLM 章節 | **GPT-4o-mini（中文 prompt）** | 成本低 |
| Storage | Cloudflare R2 | 既有 |
| Payment | NewebPay | 在地化 |
| Auth | Clerk / NextAuth | 既有 |
| Email | Resend | 通知 |

### 4.2 系統架構

```
[Browser / API Client]
   ↓
[Vercel Next.js]
   ├─ /upload → POST /api/upload (R2 multipart)
   ├─ /dashboard (jobs list)
   ├─ /jobs/[id] (即時進度 + 結果)
   └─ /api/v1/* (企業 API)
   ↓
[Inngest Queue]
   ├─ whisper.transcribe (GPU worker, Modal/Railway)
   ├─ llm.chapters
   ├─ llm.summary
   └─ subtitle.export
   ↓
[Cloudflare R2] .mp3 .wav .srt .json
   ↓
[Modal (GPU) Whisper worker]
   ↓
[Vercel Postgres]
   ├─ jobs（任務）
   ├─ users（會員 + tier）
   ├─ glossary（詞彙表）
   └─ transcripts（逐字稿 cache）
```

### 4.3 Prisma Schema（新增）

```prisma
model Job {
  id          String   @id @default(cuid())
  userId      String
  status      String   @default("queued")  // queued / running / done / failed
  audioKey    String   // R2 key
  durationSec Int
  options     Json     // {chapters: bool, summary: bool, ...}
  transcript  Json?    // {segments: [{start, end, text, speaker}]}
  chapters    Json?    // [{title, startSec, endSec}]
  summary     Json?    // {short, detailed, bullets}
  errorMsg    String?
  createdAt   DateTime @default(now())
  finishedAt  DateTime?
}

model Glossary {
  id       String @id @default(cuid())
  userId   String
  words    String // JSON array
  updatedAt DateTime @updatedAt
}

model ApiKey {
  id        String   @id @default(cuid())
  userId    String   // enterprise
  key       String   @unique
  tier      String   @default("business") // business / custom
  monthlySec Int     @default(720000) // 200 hr
  usedSec   Int      @default(0)
  expiresAt DateTime
}
```

### 4.4 API Endpoints

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/upload` | 上傳 MP3，< 500MB |
| GET | `/api/jobs/:id` | 任務狀態 + 結果 |
| POST | `/api/jobs/:id/edit-chapter` | 改章節標題 |
| POST | `/api/glossary` | 同步詞彙表 |
| **POST** | **`/api/v1/process`** | **企業 API（webhook 回傳）** |
| GET | `/api/v1/usage` | 企業用量 |
| POST | `/api/webhook/newebpay` | 金流 callback |

---

## 5. 非功能性需求

### 5.1 性能
- 60 分鐘音檔 5 分鐘完成（GPU worker）
- Dashboard 載入 < 1s
- 並行 50 jobs / Modal

### 5.2 安全
- 音檔 30 天後自動刪除（GDPR）
- API key 雜湊儲存（SHA-256）
- Rate limit 1 req/sec / key
- 用戶音檔僅本人可讀（signed URL 24hr）

### 5.3 ⭐ 降級機制

| 故障 | 降級 |
|---|---|
| Whisper worker 掛 | 排隊 + 警示 + 切 fallback 模型 |
| GPT 章節失敗 | 自動改用 Qwen2.5-7B（繁中開源） |
| R2 掛 | 改存 Supabase Storage |
| NewebPay 掛 | 銀行轉帳 fallback |
| Modal GPU 滿 | 改 Groq API（CPU 慢 2×） |

### 5.4 擴展性
- GPU worker 自動 scale 1→8
- 任務佇列分優先（Pro 優先）
- 摘要 LLM 用 GPT-4o-mini 量化成本

---

## 6. 完成標準 (DoD)

- [ ] F-001~F-007 全部實作
- [ ] 5 個 Podcaster beta 反饋 WER < 10%
- [ ] 字幕 .srt / .vtt 匯出 zip
- [ ] 企業 API 1 客戶試用（200 hr/月額度）
- [ ] Lighthouse Performance ≥ 90
- [ ] Privacy Policy + 個資刪除 SOP
- [ ] Notion PRD ≥ 9、商業化更新

---

## 7. 風險與決策

### 7.1 風險表

| Risk | 等級 | 緩解 |
|---|---|---|
| Whisper 繁中 WER > 15% | 🟠 | 微調 + glossary + LLM 後處理 |
| Modal GPU 漲價 | 🟡 | Groq 備援 + 自購 A10 替代 |
| OpenAI 章節 API 漲價 | 🟡 | 切 Qwen2.5 開源 |
| Podcaster 市場被 Otter.ai 中文版吃掉 | 🟠 | 搶繁中 niche + 章節甜蜜點 |

### 7.2 ⭐ ADR

**ADR-001 為何砍掉 TTS？**
- 決策：v2.2.2 完全不做 TTS
- 理由：ElevenLabs 11B USD / Speechify 60M users，紅海無甜蜜點
- 焦點：後製工廠（章節 + 字幕 + 摘要）才是 Podcaster 真痛點

**ADR-002 為何用 Modal 而非 Replicate？**
- 決策：Modal 為主，Replicate 備援
- 理由：Modal cost 1/3、自定義鏡像、cold start < 10s
- 取捨：Modal 規模小、文件差

**ADR-003 為何個人 NT$199 不升 NT$299？**
- 決策：保持 NT$199 / 個人
- 理由：心理門檻（NT$199 vs NT$200）+ 學生付費上限
- 創作者 NT$499 對標「真人剪 NT$800-1,600」省 60%

---

## 8. 里程碑與 Sprint

### 8.1 里程碑

| M | 時程 | 產出 |
|---|---|---|
| M0 銳化 | W1-2 | 本 PRD + 訪談 5 Podcaster + 2 企業 |
| M1 MVP | W3-8 | F-001~F-007 + 50 beta 用戶 |
| M2 GA | W9-12 | 公開 + 行銷 KOL |
| M3 PMF | W13-24 | 300 付費 + 1 企業 = NT$200K MRR |
| M4 規模 | W25-36 | 1500 付費 + 20 企業 = NT$3M MRR |

### 8.2 Sprint

| S | 主題 |
|---|---|
| S1 | Glossary 個人版 + LLM 後處理修漂字 |
| S2 | ePub 文字稿匯出 |
| S3 | 企業 API + rate limit |
| S4 | Webhook + 用量儀表板 |
| S5 | 訪談 + 5 Podcaster beta |
| S6 | GA 上線 + KOL 行銷 |

---

## 9. 變現 + 定價心理學

### 9.1 方案

| 方案 | 月費 | 額度 | 目標 |
|---|---|---|---|
| 🆓 Free | NT$0 | 30 分/月、SD | 試用 |
| 👤 Personal | NT$199 | 10 hr/月、HD | 學生 / 個人 |
| 🎙️ Creator | NT$499 | 30 hr/月、4K | Podcaster / YouTuber |
| 🏢 **Business API** | **NT$2,999** | **200 hr/月、API + Webhook** | **企業培訓 / 媒體** |
| 🎯 Custom | NT$9,999+ | 客製 | 大型媒體 |

### 9.2 定價心理學
- **NT$199 vs NT$200**：心理門檻
- **NT$499 對標真人 NT$800-1,600**：省 60%
- **NT$2,999 對標 8 場內訓 × NT$10K 人工**：省 70%
- **年繳 8 折**：提升 LTV

---

## 10. 附錄

### 10.1 Quadrant

```
       高自動化
         │
   Otter  │  ★ 本產品
   英文為主│   (繁中 + 章節 + API)
         │
低月費 ───┼── 高月費
         │
  Vrew    │  Descript
  字幕    │  $24/月
         │
       低自動化
```

### 10.2 術語表

| 術語 | 定義 |
|---|---|
| STT / Whisper | 語音轉文字 / OpenAI 模型 |
| WER | Word Error Rate 辨識錯誤率 |
| 章節切分 | 將長音檔切成主題段落 |
| Diarization | 多說話者分離 |
| Inngest | Serverless job queue |
| Modal | GPU 雲端 runtime |

---

## 11. ⭐ 市場驗證計畫

### 11.1 關鍵假設

| 假設 | 驗證 | 成功 |
|---|---|---|
| **H1**: 5/5 Podcaster 願意試用（省時痛點） | 訪談 + beta | 5 yes |
| **H2**: WER < 10% 可達 | 內部測試 10 集 | <10% |
| **H3**: 1 企業願付 NT$2,999/月 API | 訪談 2 培訓負責人 | 1 yes |

### 11.2 訪談 SOP（W1-2）
- 3 個獨立 Podcaster（>5K 訂閱）
- 2 個 Hahow / Yotta 線上講師
- 2 個企業培訓負責人

---

## 12. ⭐ 失敗模式 SOP

### F1. WER > 15%
- 緊急：增加 glossary 額度（個人 200 / Pro 2000）
- 中期：Whisper 繁中微調（自家資料）
- 長期：自訓練 wav2vec2 繁中模型

### F2. GPU 成本超預算
- 切換 Groq（CPU）備援
- 個人版降為「離峰處理」

### F3. 5 分鐘 SLA 達不到
- 加 worker 並行
- 顯示「預估 X 分鐘」誠實告知

### F4. 企業客戶退費
- 30 天滿意度保證
- 提供 migration 工具（導出 .srt / ePub）

### F5. OpenAI 章節品質下降
- 切 Qwen2.5-72B + 中文 prompt
- 加入 RAG 用戶 glossary

---

## 13. ⭐ MetaGPT / spec-kit 對齊

### 13.1 Requirement Pool
- **P0（MVP）**：F-001~F-007
- **P1（v2）**：F-101~F-106
- **P2（v3）**：F-201~F-204

### 13.2 MUST / SHOULD / MAY

| 標籤 | 項目 |
|---|---|
| MUST | 60 分鐘 5 分鐘章節 + 字幕 + 摘要 + WER<10% |
| SHOULD | ePub 匯出、詞彙表、企業 API |
| MAY | 多說話者分離、即時轉寫、小宇宙 API |

### 13.3 Quadrant

```
      高 LTV
       │
  Free │  ★ Business API
       │   + Creator
低可行性─┼─ 高可行性
       │
       │  Personal
      低 LTV
```

### 13.4 Open Questions

| # | 問題 | 待 |
|---|---|---|
| Q1 | Modal GPU 與 Groq 成本比較？ | Alan |
| Q2 | NewebPay 簽章文件？ | 業務 |
| Q3 | 章節命名 LLM 是否自托管？ | Alan |
| Q4 | GPT 漲價時備援？ | 業務 |

---

## 15. ⭐ 深度市調報告 (Sweet Spot 5 問)

### 15.1 5 問體檢

**最終商業化評分**：**69 / 100**
- 公式：(PRD × 0.3 + sweet × 0.7) × 10
- PRD 規格 = 9 / 10（v2.2.2 14 區塊 + AC 量化 + 降級）
- Sweet Spot = 6 / 10（從 v2.2.1 的 3 升到 6 — 砍掉 TTS 紅海、聚焦繁中後製 niche）
- 計算：(9×0.3 + 6×0.7) × 10 = **69**

#### Q1 市場已有誰？

| 競品 | 用戶 | 月費 | 繁中 |
|---|---|---|---|
| **Otter.ai** | 10M+ | $20 | ⚠️ 英文為主 |
| **NotebookLM** | 100M+ | Free | ⚠️ 僅自家 |
| **ElevenLabs** | 1M+ | $5+ | ✅ Multilingual v2 |
| **Descript** | 3M+ | $24 | ⚠️ 英文 UI |
| **Vrew** | 5M+ | Free | ✅ 影片為主 |
| **雅婷（台語 TTS）** | — | Free | ✅ 僅 TTS |
| **真人剪輯** | — | NT$800-1,600/集 | — |
| **繁中 Podcast 後製工廠** | — | — | **空白** |

#### Q2 甜蜜點？
**甜蜜點 = 繁中唯一「長音檔後製工廠」**
- Otter / NotebookLM：英文為主、繁中 WER >25%
- Descript / Vrew：英文 UI、無繁中優化
- 真人剪：貴、慢

#### Q3 紅海功能（不做）
- ❌ TTS 多引擎（11B USD 紅海）
- ❌ 聲音克隆（紅海 + 法律）
- ❌ 即時口譯 / 翻譯（Kudo 紅海）
- ❌ Podcast 託管（Firstory / SoundOn 紅海）
- ❌ 影音剪輯（CapCut 紅海）

#### Q4 紅海外差異化？
> **「繁中唯一 Podcast 後製工廠 — 月省 16-32 小時後製」**
1. Whisper 繁中微調 WER<10%
2. GPT 章節自動命名（中文 prompt）
3. ePub / .srt / .vtt 多格式匯出
4. 個人詞彙表 50-500 詞
5. **企業 API + Webhook**

#### Q5 一人公司能否負擔？
- 開發：MVP ~30 人天 → Sean 6 週可完成
- 營運：M12 預估 NT$15K/月（Modal + Inngest + Vercel + R2）
- 成本結構：Modal GPU 為主（NT$0.5/hr），毛利 70%
- CAC：Podcast KOL + SEO，自然流量，趨近零

**結論**：可負擔，毛利 70%，甜蜜點清晰。**M1 招募 5 Podcaster 試用 + M3 1 企業客戶付費**才進入規模。

### 15.2 重寫決策

| 改變 | v2.2.1 | v2.2.2 |
|---|---|---|
| 命名 | text-to-speech-mvp | **「Podcast 後製工廠」概念更精準** |
| 變現 | 4 方案 | **+ 企業 API NT$2,999 為主** |
| 功能 | 5 MVP | **+ ePub / glossary** |
| TA | 不分 | **鎖定繁中 Podcaster / 線上講師** |

### 15.3 與 v1 差異

| 面向 | v1 | v2.2.1 | v2.2.2 |
|---|---|---|---|
| 甜蜜點 | TTS 多引擎 | 後製工廠 | **+ 企業 API 鎖定繁中** |
| 變現 | 4 方案 | 同 | **+ 企業 API + 詞彙表 + ePub** |
| MVP | 7 features | 5 | 7（含 ePub/glossary）|

### 15.4 後續驗證
- [ ] W1-2 訪談 7 人
- [ ] W3-8 MVP 上線 + 50 付費 beta
- [ ] W9-12 GA + 1 企業 API 客戶
- [ ] W13-24 PMF：300 付費 + 1 企業 = NT$200K MRR → 規模化

---

> 對接 Repo：https://github.com/openclawsean024-create/text-to-speech-mvp
