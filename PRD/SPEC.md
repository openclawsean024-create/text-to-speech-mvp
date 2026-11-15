# 文字轉語音 MVP — 規格計劃書 v3.0.2（2026-11-16 PRD 重建版：繁中 TTS 與有聲書工作台）

> 產品名稱（Notion「可產品化商品」）：**繁中 TTS 與有聲書工作台**｜優先順序 **P2**｜開發順位 **第 4 個**
> 主 repo：`openclawsean024-create/text-to-speech-mvp`（預設分支 `master`）
> 併入來源：`ebook-to-audiobook`、`tts-mvp`、`ebook-audio`（只讀，不在本次修改）
> 文件性質：**以實際程式碼為準的重建版**。本次只改文件，未開發任何功能。
> 標題保留「v3.0.2」字樣：`e2e/smoke.test.mjs` 以正規表示式檢查此標題與「v3.0.2 改版摘要」字串，改動會使既有測試失敗；版本語意以本文件 §0 為準。

---

## 0. 本版說明

### 0.1 v3.0.2 改版摘要（沿革，保留）

- v3.0（2026-07-19）：定位為「TTS 介面 + Podcast 後製」，聚合 5 個 TTS 引擎、12 情緒 × 12 角色 × 12 預設、Shorts 9:16、NewebPay 三層訂閱、企業 API。
- v3.0.2（2026-09-06）：補 `PRD/CHANGELOG.md`、`e2e/smoke.test.mjs`、GHA `ci.yml` / `deploy.yml` 改指向 `master`。
- 舊版 SPEC 的大量章節（含與本產品無關的 Sui / Solidity 比較、未查證的市場數字、真人訪談話術）已於本版移除；需要時可從 git 歷史 `96b2eac` 取回。

### 0.2 本次重建（2026-11-16）的依據與原則

1. **唯一商業依據**：Notion「可產品化商品」資料庫該列（產品名稱、P2、第 4 個、目標客群、獲利模式、完成度 65、上市前要補、主要風險）。
2. **功能現況以程式碼為準**：逐一閱讀四個 repo 的頁面、API、lib、資料模型、測試與 `package.json`；README / 舊 PRD 與程式不一致處於 §13 列出。
3. **外部事實**（競品價格、市場規模、條款細節）沒有可靠出處時一律標「待確認」，不沿用舊 PRD 中無出處的數字。

---

## 1. 問題陳述

- 繁體中文內容創作者（Podcast、自媒體）、出版社與企業內訓需要把文字或電子書轉成可發布的語音，但：
  - 多數 TTS 服務的繁中多音字、專有名詞、數字讀法需要逐句人工修正，缺少可重複使用的**發音校正詞庫**。
  - 電子書轉有聲書需要「章節切分 → 分章合成 → 章節標記 → 字幕」的完整流程，單純的 TTS 工具只處理短文字（本 repo 現況：抽文字後截斷為 5,000 字）。
  - 各 TTS 引擎價格與條款不同，使用者難以比較，也難以預估「一本書要花多少錢」。
- 現況：相關能力分散在 4 個 repo（見 §3、§12），主 repo 有多引擎 TTS 與後製管線，有聲書流程在 `ebook-to-audiobook`，兩者未整合，且按字數計費、發音詞庫、測試均不完整。

## 2. 目標客群與獲利模式

| 客群（Notion） | 主要情境 | 對應功能 |
|---|---|---|
| Podcaster | 開場白、旁白、節目稿配音；長稿分段 | FR-001、FR-003、FR-011 |
| 自媒體 | 短影音配音、批次產出 | FR-001、FR-015、FR-022 |
| 出版社 | 自有版權書目轉有聲書、章節音檔與字幕 | FR-005～FR-010、FR-024 |
| 企業內訓錄製 | 教材文字轉語音、專有名詞統一讀法 | FR-001、FR-011、FR-016 |

- **獲利模式**（Notion）：SaaS 訂閱 + 免費增值。
- **計費單位**（上市前要補）：**按字數計費**——訂閱方案含每月字數額度，超額另計或升級。單價、方案名稱與額度 **待 Sean 決定**（目前程式內有兩套互相衝突的方案，見 §13）。
- 免費層：瀏覽器內建語音（Web Speech API，無伺服器 TTS 成本）＋少量雲端字數試用（額度待確認）。

## 3. 競品與差異

> 以下僅列名稱與定位，價格、方案內容、繁中品質皆 **待確認**（舊 PRD 的數字無可靠出處，已移除）。

| 類型 | 代表（名稱） | 本產品差異（假設，待驗證） |
|---|---|---|
| 國際 TTS 平台 | ElevenLabs、Murf、Play.ht（待確認現況） | 繁中 UI、繁中發音校正詞庫、多引擎可切換 |
| 雲端 TTS API | Azure AI Speech、Google Cloud TTS、OpenAI TTS | 本產品是工作台而非單一引擎；提供章節化有聲書流程與字數計費 |
| 朗讀 / 有聲書工具 | Speechify、NaturalReader（待確認） | 面向「產出可發布音檔」而非個人聆聽；出版社自有書目流程 |
| 繁中在地方案 | 雅婷等在地語音服務（待確認） | 待訪談與盲測後確認 |

差異化主張需以 M2 的繁中盲測與使用者訪談驗證，驗證前不得在對外文案中宣稱「唯一」「最佳」。

## 4. 現有實作盤點（以程式碼為準）

### 4.1 主 repo `text-to-speech-mvp`（commit `96b2eac`）

- 技術棧：Next.js 14 App Router、React 18、TypeScript + 部分 CommonJS（`lib/*.js`）、Tailwind 3、Clerk（未設定時為 demo mode，`middleware.ts` 為 no-op）、Vercel KV（未設定時用記憶體，cold start 即遺失）、OpenAI SDK、epubjs / pdf-parse / mammoth。部署：Vercel（`vercel.json` buildCommand `pnpm run ci`，region `hnd1`）。
- 頁面：`/`（單段 / 批次轉換、瀏覽器語音、檔案匯入、分享）、`/dashboard`（用量、引擎 key 管理）、`/pricing`、`/login`、`/signup`、`/contact`、`/privacy`、`/terms`、404。
- API：`/api/tts`、`/api/batch`、`/api/queue`、`/api/preview`、`/api/catalog`、`/api/extract-text`、`/api/shorts`、`/api/glossary`、`/api/keys`、`/api/usage`、`/api/billing/checkout`、`/api/billing/subscription`、`/api/webhook/newebpay`、`/api/webhook/test`、`/api/health`、`/api/v1/process`、`/api/v1/jobs/[id]`、`/api/v1/jobs/[id]/download`、`/api/v1/keys`、`/api/v1/usage`。
- 資料（KV key 前綴）：`user:{id}:apikey:{engine}`（明文）、`user:{id}:usage:{date}`（每日次數）、`subscription:{id}`、`glossary:{id}`、`job:{id}`、`audio:{id}`（僅 ≤100KB 才寫入 KV）、API key 記錄（SHA-256 雜湊）。
- 測試：`scripts/ci-smoke.js`（8 項模組載入／格式檢查）、`e2e/smoke.test.mjs`（`node:test`，建置後結構檢查）。**沒有單元測試框架，API route 沒有測試。**
- 遺留檔：根目錄 `index.html`（0 byte）、`index-v1.0.html`、`landing.html`、`pricing.html`、`dashboard.html`、`api/tts.js`、`api/health.js`、`lib/rate-limiter.js`（舊版 Vercel Functions，`vercel.json` 只建置 Next.js，推定未部署，待確認）。

### 4.2 `ebook-to-audiobook`（VoxChapter，commit `master` HEAD）

- 技術棧：Next.js `^16.2.10`（README 寫 14）、React 18、Supabase（Auth / Postgres / Storage）、vitest。
- 已實作：
  - `src/lib/engine/parser.ts`：純文字章節切分（第N章／回／節、Chapter N）、檔案類型魔術位元組判斷、50MB 上限、繁中朗讀時間估算、slugify、HTML 清理。
  - `src/lib/engine/characters.ts`：對話角色偵測（規則式）、5 個內建 zh-TW 聲音 ID、角色自動配音、跨章固定對應、低信心需確認。
  - `src/lib/engine/tts.ts`：Provider 介面 + Orchestrator 依序降級；**Google / Azure adapter 為 stub，實際回傳 Mock 正弦波**；`MockTtsProvider` 可離線測試。
  - `src/lib/engine/audio.ts`：PCM16 WAV 組裝、章節標記、`{slug}-chapter-XX.mp3` 命名、ID3 標籤字串。
  - `src/lib/engine/subtitles.ts`：依合成片段時序產生 SRT / VTT。
  - `src/lib/engine/rss.ts`：Podcast RSS XML 與 token 化音檔 URL。
  - API：`/api/conversions`（上傳 EPUB/PDF/TXT → 內嵌解析 → ElevenLabs BYOK 合成 → Supabase Storage **公開 bucket**；依方案字數額度 free 10k / pro 100k / business 500k）、`/api/conversions/[id]`、`/share`、`/api/shared/[token]`、`/api/keys`（ElevenLabs key 明文存 `profiles`）、`/api/usage`（字數）、`/api/voices`、`/api/voices/clone`（ElevenLabs 聲音複製）、`/api/engine/preview`、`/api/rss/demo`、`/api/auth/callback`。
  - 頁面：首頁、`/converter`、`/dashboard`、`/player/[id]`、`/share/[token]`、`/settings`、`/pricing`（USD $9 / $29）、`/login`、`/register`。
  - 測試：8 個 vitest 檔（parser、characters、tts、audio、subtitles、rss、api-routes、integration）+ `e2e/smoke.test.ts`（需先 build）。
- 重要缺陷：`engine/*` 模組**未接到** `/api/conversions`（後者另寫一套解析）；`/api/conversions` 每個片段**合成兩次**（第一輪結果丟棄，成本加倍）；MP3 以 `Buffer.concat` 直接串接；把模型 ID `eleven_multilingual_v2` 當作 voice ID 呼叫；UI 列出 OpenAI / Kokoro 但後端只有 ElevenLabs。
- 其他：`legacy/app.py`（FastAPI + edge-tts + gTTS，未納入建置）；`test-book.epub` 疑似商業出版之受著作權保護電子書（見 §9）。

### 4.3 `tts-mvp` 與 `ebook-audio`

- 兩者實際只有 `dashboard.html`（Tailwind CDN 通用儀表板樣板：任務清單、客戶管理等假資料，**沒有任何 TTS、EPUB、IndexedDB 程式**）＋ PRD 文件＋ CI workflow。
- 兩份 PRD 把多項功能標為「✅ shipped」（Edge TTS、IndexedDB 歷史、EPUB 解析、MP3 下載等），**與程式不符**。

## 5. 功能需求（FR）

狀態定義：**已實作**＝程式可運作且路徑完整；**部分**＝有程式但有已知缺口或未接入主流程；**未實作**＝無程式。
所在 repo 縮寫：**主**＝text-to-speech-mvp、**EB**＝ebook-to-audiobook、**—**＝無。

| ID | 需求 | 優先 | 狀態 | 所在 repo／檔案 | 備註 |
|---|---|---|---|---|---|
| FR-001 | 單段文字轉語音，支援多引擎（OpenAI、ElevenLabs、Kokoro、Azure、Google） | P0 | 已實作 | 主 `app/api/tts/route.ts`、`lib/tts-engines.js` | 金鑰取自 request body 或環境變數；未登入不計量 |
| FR-002 | 免費瀏覽器內建語音（Web Speech API） | P1 | 已實作 | 主 `app/page.tsx`；EB `converter/page.tsx` | 無伺服器成本 |
| FR-003 | 長文字自動分段（5,000 字）與合併 | P0 | 部分 | 主 `app/api/tts/route.ts` | 合併依賴 `ffmpeg` 執行檔，Vercel 環境未驗證 |
| FR-004 | MP3 / WAV 輸出 | P0 | 部分 | 主 `app/api/tts/route.ts` | WAV 轉檔依賴 `ffmpeg` |
| FR-005 | 文件匯入抽文字（TXT／SRT／VTT／LRC／PDF／EPUB／DOCX） | P0 | 部分 | 主 `app/api/extract-text/route.ts`；EB `api/conversions` | 主 repo 截斷為 5,000 字；錯誤訊息寫 4MB、實際上限 10MB |
| FR-006 | 電子書章節切分與檔案類型驗證 | P0 | 部分 | EB `src/lib/engine/parser.ts` | 有測試；未接入 EB 自己的轉換 API；主 repo 無 |
| FR-007 | 整本有聲書轉換（逐章音檔＋整本音檔＋進度） | P0 | 部分 | EB `src/app/api/conversions/route.ts` | 僅 ElevenLabs；重複合成、MP3 直接串接、voice ID 錯用；主 repo 無 |
| FR-008 | 章節標記、ID3 標籤、輸出檔命名 | P1 | 部分 | EB `src/lib/engine/audio.ts` | 僅 WAV／Mock；未接主流程 |
| FR-009 | 依合成時序產生 SRT / VTT 字幕 | P1 | 部分 | EB `src/lib/engine/subtitles.ts` | 主 repo 有逐字稿用 SRT/VTT（`lib/post-process.js`），用途不同 |
| FR-010 | 多角色對話偵測與分角色配音 | P1 | 部分 | EB `src/lib/engine/characters.ts` | 規則式；只用於 `/api/engine/preview` |
| FR-011 | **繁中發音校正詞庫**（系統預設＋使用者自訂，合成前套用） | P0 | 未實作 | — | 主 repo `glossary` 只給 Whisper 逐字稿用，不影響 TTS |
| FR-012 | 繁中文字正規化（數字、貨幣、百分比） | P1 | 部分 | 主 `lib/tts-prompts.js` `normalizeZhText` | 函式存在但未接入 `/api/tts` |
| FR-013 | 情緒／角色／預設目錄 | P2 | 部分 | 主 `lib/tts-prompts.js`、`/api/catalog` | 只有目錄 API，UI 與合成流程未使用 |
| FR-014 | 聲音清單、收藏與試聽 | P1 | 已實作 | 主 `lib/voices.ts`、`components/VoiceSelector.tsx`、`/api/preview` | 試聽只走 OpenAI |
| FR-015 | 批次轉換佇列 | P1 | 部分 | 主 `/api/batch`、`contexts/QueueContext.tsx`、`/api/queue` | 批次只支援 3 個引擎；佇列在記憶體 |
| FR-016 | **按字數計量與額度**（伺服器端決定方案） | P0 | 部分 | EB `api/conversions`、`api/usage`（字數）；主 `lib/db.ts`（每日次數） | 主 repo 計「次數」且方案由用戶端傳入 `plan` |
| FR-017 | 訂閱與金流（NewebPay） | P1 | 部分 | 主 `lib/newebpay.js`、`/api/billing/*`、`/api/webhook/newebpay`、`lib/subscriptions.ts` | 無 UI 串接；未經沙箱端到端驗證；webhook 會 log 整筆解密交易資料 |
| FR-018 | 使用者帳號與登入（Clerk） | P0 | 部分 | 主 `components/AuthProvider.tsx`、`hooks/useClerk.ts` | 未設定時 demo mode；middleware 無保護 |
| FR-019 | 使用者自帶引擎金鑰（BYOK）管理 | P2 | 部分 | 主 `/api/keys`、`lib/db.ts`；EB `/api/keys` | 皆以明文儲存 |
| FR-020 | 企業 API（`/api/v1/process`、jobs、keys、HMAC webhook） | P2 | 部分 | 主 `app/api/v1/*`、`lib/api-keys.ts`、`lib/webhook.js` | 匿名可建立任意 tier key；`audioUrl` 無 SSRF 防護 |
| FR-021 | Podcast 後製（Whisper 逐字稿、章節、摘要、字幕、ePub） | P2 | 部分 | 主 `lib/whisper.js`、`lib/post-process.js`、`lib/epub.js`、`lib/jobs.ts` | 音檔 >100KB 不寫入 KV；背景工作以 fire-and-forget 執行 |
| FR-022 | 短影音 9:16 MP4 產生 | P2 | 部分 | 主 `/api/shorts`、`lib/shorts.js` | 依賴 `ffmpeg` 與字型檔 |
| FR-023 | 個人詞彙表（Whisper 提示用） | P2 | 已實作 | 主 `/api/glossary`、`lib/glossary.ts` | tier 由用戶端傳入 |
| FR-024 | **使用者自有內容聲明與產出存取控制** | P0 | 未實作 | — | 主 repo 下載端點建立 30 天內可匿名下載；EB 以公開 bucket 存音檔 |
| FR-025 | 播放頁與分享連結 | P2 | 部分 | EB `player/[id]`、`share/[token]`；主 `app/page.tsx` 分享 | 主 repo 分享把前 500 字原文放進 URL；EB 分享 RLS 與程式不一致 |
| FR-026 | Podcast RSS 輸出 | P2 | 部分 | EB `src/lib/engine/rss.ts`、`/api/rss/demo` | 只有寫死的示範 feed |
| FR-027 | 聲音複製（voice cloning） | P2 | 部分 | EB `/api/voices/clone` | 涉及聲音樣本與同意問題，**暫不併入**（待 Sean 決定） |
| FR-028 | 繁中／英文介面 | P2 | 已實作 | 主 `contexts/LangContext.tsx`、`locales/` | |
| FR-029 | **TTS 測試模式（Mock provider）**：測試與 CI 不呼叫付費 API | P0 | 部分 | EB `src/lib/engine/tts.ts` `MockTtsProvider` | 主 repo 無 |
| FR-030 | 隱私權政策、服務條款、AI 語音揭露 | P0 | 部分 | 主 `app/privacy`、`app/terms` | 未涵蓋電子書著作權、AI 語音揭露與資料保留期間 |

## 6. 非功能需求

| 類別 | 需求 |
|---|---|
| 可測試性 | 所有 P0 domain 邏輯（分段、章節切分、詞庫套用、字數計量、額度判斷）有單元測試；API route 以 Mock provider 做整合測試；CI 不得呼叫付費 TTS。 |
| 可重現建置 | `pnpm install --frozen-lockfile` 與 `pnpm run ci` 在乾淨環境可重跑；目前 GHA 因 `pnpm-workspace.yaml` 缺 `packages` 欄位而失敗（§13）。 |
| 效能 | 單段 ≤5,000 字的合成延遲以引擎回應為主（目標值待確認）；整本轉換必須是可續跑的背景工作，不得依賴單一 serverless 請求。 |
| 成本控制 | 每次合成前檢查字數額度；同一片段不得重複呼叫付費 API；記錄每個引擎的字數用量以便對帳。 |
| 安全 | 方案、tier、額度一律由伺服器端決定；BYOK 金鑰加密儲存或不落地；外部 URL 抓取需防 SSRF；webhook 驗簽。 |
| 可用性 | 繁中介面為主；錯誤訊息需說明可採取的行動。 |
| 相容性 | Node ≥18（CI 使用 20）；pnpm 9。 |

## 7. 資料與個資處理

| 資料 | 來源 | 現況儲存 | 目標規則 |
|---|---|---|---|
| 帳號識別（Clerk userId、email） | 使用者註冊 | Clerk | 只存 userId；email 不寫入 log |
| 輸入文字／電子書檔 | 使用者上傳 | 主：不落地（抽文字後回傳）；EB：解析後即用 | 處理完即刪；不得放進 URL（現況分享連結違反） |
| 產出音檔／字幕 | 系統產生 | 主：直接回應；EB：Supabase 公開 bucket | 私有儲存＋擁有者授權下載；保留期間待 Sean 決定 |
| Podcast 原始音檔與逐字稿 | 使用者上傳 | KV（≤100KB）或記憶體，30 天 TTL | 同上；需明示保留期間 |
| 引擎 API key（BYOK） | 使用者 | 主：KV 明文；EB：Postgres 明文 | 加密儲存或改為每次請求帶入不落地 |
| 用量與訂閱 | 系統 | KV | 保留對帳所需最小欄位 |
| 金流交易資料 | NewebPay 通知 | 僅存訂單號、金額、方案 | 移除整筆解密內容的 log |
| 聲音樣本（voice cloning） | 使用者 | EB：Supabase `voice-samples` | 不併入；若未來要做，需本人同意流程與法律意見 |

- 開發與測試一律使用假資料（例：`demo-user-001`、`範例書名`、`test@example.com`）；不得把真實個資、客戶資料或憑證寫入 repo、fixture、log 或截圖。
- 適用台灣個人資料保護法；隱私權政策需列出蒐集目的、第三方（TTS 引擎、Clerk、Vercel、NewebPay）、保留期間與刪除方式（細節待法律覆核）。

## 8. 法規與風險

### 8.1 TTS 引擎成本與條款（Notion 主要風險 1）

| 風險 | 說明 | 對策 |
|---|---|---|
| 成本變動 | 各引擎按字元或用量計價，價格可能調整（現行單價 **待確認**） | 引擎成本表放設定檔並記錄生效日；字數計費單價保留毛利緩衝；每月對帳 |
| 條款變動／商用限制 | 各引擎對商用、轉售、AI 語音揭露、輸出所有權規定不同（細節 **待確認**，需逐家閱讀現行條款原文） | 上市前完成條款比對表；每季覆核；不符條款的引擎不上架 |
| 非官方端點 | `tts-mvp` PRD 與 EB `legacy/app.py` 使用的 Edge TTS（`edge-tts`）非公開商用 API | **不採用** |
| BYOK 轉嫁責任 | 使用者自帶金鑰時，條款責任分界需在服務條款寫清楚 | 條款增訂；BYOK 金鑰加密 |
| 單一引擎依賴 | 引擎停用或漲價 | 保留多引擎與 Mock；引擎可由設定關閉 |

### 8.2 電子書著作權（Notion 主要風險 2）

- 規則：**只處理使用者自有或已取得授權的內容**。上傳電子書時必須勾選權利聲明（FR-024），聲明內容與時間戳記存檔。
- 產出音檔預設私有，只限擁有者下載；公開分享、RSS、出版社散布需另行授權流程（M2 以後）。
- 不提供 DRM 移除或破解功能；不接受已知受 DRM 保護的檔案（判斷方式待確認）。
- 依台灣著作權法，將他人著作轉為有聲書並散布可能涉及重製、改作與公開傳輸；個人合理使用與視障者相關例外的適用範圍 **需法律意見確認（待確認）**。
- repo 內不得放受著作權保護的書籍作為測試檔；EB 的 `test-book.epub` 疑似商業出版品，**不得搬入**，建議 Sean 決定是否自 EB repo 移除。

### 8.3 其他風險

| 風險 | 對策 |
|---|---|
| 個資外洩（分享連結含原文、公開 bucket、明文金鑰） | FR-024、§7 規則；M1 先修存取控制 |
| 計費繞過（用戶端可指定 `plan` / `tier`） | M1 AC-008 |
| Serverless 背景工作中斷 | M2 改為佇列 + 可續跑工作 |
| CI 長期紅燈 | M1 AC-001 |

## 9. 里程碑

| 里程碑 | 目標 | 範圍 | 退出條件 |
|---|---|---|---|
| **M1 合併與可驗證核心** | 四個 repo 收斂為主 repo 單一產品；補測試；完成字數計量與發音詞庫的核心邏輯；全程測試模式 | `GOAL.md` AC-001～AC-009 | CI 綠燈 + Sean 覆審 |
| M2 付費前置 | 可在沙箱完成付費流程與整本轉換 | 私有物件儲存與背景佇列；多角色配音（FR-010）；播放頁（FR-025）；NewebPay 沙箱端到端；詞庫管理 UI；BYOK 加密；SSRF 防護；條款比對表；繁中盲測與 5 位以上目標客群訪談（人數待確認） | Sean 核定定價與條款；法律意見完成 |
| M3 上市 | 正式收費 | 正式引擎合約／金鑰、正式金流、監控與告警、對帳報表、出版社批次與 RSS（FR-026）、上線檢查清單 | 上線核准 |

## 10. 成功指標

> 數值為建議目標，**待 Sean 確認**；上市後才有真實數據，不得預先宣稱。

| 階段 | 指標 | 建議目標 |
|---|---|---|
| M1 | `pnpm run ci` 與 `pnpm test` 在 GHA 綠燈 | 100% |
| M1 | P0 domain 模組（分段、章節、詞庫、計量）單元測試 | 每模組 ≥1 個測試檔，涵蓋正常與邊界案例 |
| M1 | 測試期間對付費 TTS 網域的外呼次數 | 0 |
| M2 | 繁中盲測：校正詞庫套用後的讀錯率下降 | 待確認 |
| M2 | 整本（≥10 章 fixture）轉換在測試模式完成率 | 100% |
| M3 | 免費 → 付費轉換率、每字毛利、月留存 | 待確認 |

## 11. M1 範圍外（統一列出）

真實金流交易、付費 TTS API 的正式呼叫（測試一律 Mock）、真實個資與客戶資料、正式部署與 production 設定變更、聲音複製、公開分享與 RSS 散布、DRM 處理、封存或刪除被併入的 repo。

## 12. 合併清單

### 12.1 要搬進主 repo

| # | 來源 | 模組／功能 | 搬入方式 | 里程碑 | 對應 FR |
|---|---|---|---|---|---|
| 1 | EB `src/lib/engine/parser.ts` + `__tests__/parser.test.ts` | 章節切分、魔術位元組判斷、50MB 上限、朗讀時間估算、slugify、HTML 清理 | 移植為主 repo `lib/audiobook/parser.ts`，測試一併移植 | M1 | FR-006 |
| 2 | EB `src/lib/engine/tts.ts`（`MockTtsProvider`、`TtsOrchestrator`）+ `tts.test.ts` | Provider 介面、降級順序、離線 Mock | 只搬介面、Orchestrator 與 Mock；Google/Azure stub **不搬**，改包裝主 repo 既有 `lib/tts-engines.js` | M1 | FR-029 |
| 3 | EB `src/lib/engine/audio.ts` + `audio.test.ts` | 章節標記、輸出命名、ID3 標籤 | 移植；WAV 組裝保留供測試，正式 MP3 合併另行處理 | M1 | FR-008 |
| 4 | EB `src/lib/engine/subtitles.ts` + `subtitles.test.ts` | 依合成時序產生 SRT/VTT | 移植，與主 repo `post-process.js` 的格式函式共用或擇一 | M1 | FR-009 |
| 5 | EB `api/conversions`、`api/usage` 的**字數額度概念** | 依方案的每月字數上限、超額回 402 | 只搬規則，改寫到主 repo KV 用量模組；不搬 Supabase 實作 | M1 | FR-016 |
| 6 | EB `integration.test.ts`、`api-routes.test.ts` 與 vitest 設定 | 管線整合測試寫法 | 改寫為主 repo 測試（parse → Mock TTS → 章節音檔 → 字幕） | M1 | FR-007、FR-029 |
| 7 | EB 有聲書轉換流程（上傳 → 章節 → 逐章合成 → 進度） | 流程與 UI 概念 | 在主 repo 以搬入的模組重寫，修正重複合成與 voice ID 問題 | M1（Mock）／M2（正式引擎） | FR-007 |
| 8 | EB `src/lib/engine/characters.ts` + `characters.test.ts` | 多角色偵測與配音 | 移植 | M2 | FR-010 |
| 9 | EB `player/[id]`、`share/[token]` 頁面 | 播放與分享 | 在私有儲存與授權完成後重寫 | M2 | FR-025 |
| 10 | EB `src/lib/engine/rss.ts` + `rss.test.ts` | Podcast RSS | 移植，示範 feed 不搬 | M3 | FR-026 |
| 11 | `ebook-audio` PRD §19.5 免責聲明文字概念 | 自有內容聲明 | 改寫為 FR-024 的權利聲明文案 | M1 | FR-024、FR-030 |

### 12.2 不搬及原因

| 來源 | 項目 | 原因 |
|---|---|---|
| EB | Supabase Auth / Postgres / Storage、`supabase/schema.sql`、`src/lib/supabase/*` | 主 repo 已用 Clerk + KV，不並存兩套認證與資料層；`audiobooks` bucket 為公開，有個資與著作權風險 |
| EB | `/api/conversions` 內嵌實作 | 重複合成（成本加倍）、MP3 直接串接、voice ID 錯用；以 12.1 #7 重寫取代 |
| EB | `/api/keys`、`profiles.elevenlabs_api_key` | 金鑰明文儲存 |
| EB | `/api/voices/clone`、`/api/voices/[id]`、`cloned_voices` | 聲音複製需本人同意與法律意見；待 Sean 決定 |
| EB | `src/data/plans.ts`、`/pricing`（USD $9 / $29） | 與主 repo NT$ 方案衝突；方案待 Sean 統一決定 |
| EB | `legacy/app.py`、`requirements.txt`、`railway.json` | Python 舊版；使用非官方 edge-tts 與 gTTS，條款風險 |
| EB | `test-book.epub` | 疑似受著作權保護的商業出版電子書 |
| EB | `app.html`、`landing.html`、`dashboard.html`、`upload-confirm.png`、`reports/`、`docs/plans/` | 靜態舊稿與過程紀錄，無可執行功能 |
| EB | `.vercel/project.json`、`vercel.json`、CI workflow | 部署設定屬各 repo，不搬 |
| EB | Next.js 16 版本 | 主 repo 為 Next.js 14；只搬框架無關的純 TS 模組，框架升級另議 |
| tts-mvp | `dashboard.html`、`SPEC.md`、`PRD/*` | `dashboard.html` 為無 TTS 邏輯的通用樣板；PRD 標示的已上線功能不存在；市場數字無可靠出處 |
| ebook-audio | `dashboard.html`、`PRD/*` | 同上；僅取 12.1 #11 的文案概念 |
| 全部 | 主 repo 已有的功能（多引擎 TTS、瀏覽器語音、檔案抽文字、SRT/VTT 格式、ePub、登入、金流、批次） | 不重複搬 |

## 13. README／舊 PRD 與程式不一致處

| repo | 文件說法 | 程式實況 |
|---|---|---|
| 主 | README「繁中 prompt 預訓練 5000 句」 | `lib/tts-prompts.js` 為列舉＋規則，程式註解自述非模型、無語料 |
| 主 | README「上傳 MP3/WAV ≤500MB」 | 音檔 >100KB 時不寫入 KV，之後讀不到；Vercel 請求大小限制未驗證 |
| 主 | `CHANGELOG` v3.0.2「typecheck／lint／smoke／build／e2e 全部 ✅」 | GHA `master` 最近 3 次 ci 皆失敗：`pnpm install` 報 `packages field missing or empty` |
| 主 | `AGENTS.md`「`pnpm run ci` = typecheck + lint + smoke + build」 | 實際還跑 `node --test e2e/smoke.test.mjs`，且 build 內又跑一次 smoke |
| 主 | `AGENTS.md`「兩份鎖定檔並存」 | 屬實（`pnpm-lock.yaml` 與 `package-lock.json` 皆已入庫） |
| 主 | `/pricing` 頁面方案 | 頁面方案（免費每日 10 次等）與 `lib/newebpay.js` 三層 NT$99/299/2,999 不一致；頁面寫「即將支援線上升級」，無結帳串接 |
| 主 | 個人詞彙表「提升繁中品質」 | 只用於 Whisper 逐字稿提示，不影響 TTS 發音 |
| 主 | 12 情緒 × 12 角色 × 12 預設 | 僅 `/api/catalog` 回傳目錄，UI 與 `/api/tts` 未使用 |
| EB | README「Next.js 14」「EPUB & TXT」 | `package.json` 為 Next.js `^16.2.10`；也支援 PDF |
| EB | README「AI voices via ElevenLabs」、`engine/tts.ts`「Google 主、Azure 備援」 | 真正呼叫的只有 ElevenLabs；Google/Azure adapter 回傳 Mock 音訊 |
| EB | 分享連結 | `share` 直接以 conversion UUID 當 token，未寫入 `shared_link` 欄位；migration 的 RLS 政策要求 `shared_link IS NOT NULL`，匿名讀取可能失敗（待驗證） |
| tts-mvp | PRD FR-001～FR-008「✅ shipped」 | `dashboard.html` 無任何 TTS／IndexedDB／上傳程式 |
| ebook-audio | PRD FR-001～FR-006「✅ shipped」 | 同上 |

## 14. 待確認事項

1. 計費單價、方案名稱與每月字數額度（NT$ 三層 vs USD 兩層需二擇一）。
2. 「計費字數」定義（建議：詞庫套用與正規化前的原文，去除空白後的 Unicode 字元數；標點是否計入待決定）。
3. 被併入的三個 repo 在 M1 完成後的處置（封存／保留唯讀），本次不動。
4. 聲音複製（FR-027）是否列入產品。
5. 產出檔與上傳檔的保留期間。
6. 各 TTS 引擎現行價格與商用條款（需逐家查證原文）。
7. 電子書著作權合理使用與視障者例外的法律意見。
8. 競品現況、價格與繁中品質（M2 盲測）。
