# 繁中 TTS 與有聲書工作台（text-to-speech-mvp）

> 狀態：**M1 開發中（測試模式）**。尚未正式上線收費；付費方案價格未定。
> 權威規格：[`PRD/SPEC.md`](./PRD/SPEC.md)、[`GOAL.md`](./GOAL.md)；進度：[`STATUS.md`](./STATUS.md)；驗證指令：[`SOP.md`](./SOP.md)。

把文字或使用者自有的電子書轉成語音的繁中工作台：多引擎文字轉語音、整本電子書轉逐章有聲書（含章節標記與字幕）、按字數計量的每月額度、繁中發音校正詞庫。

## 目前可用的功能（以程式為準）

| 功能 | 狀態 | 入口 |
|---|---|---|
| 單段／長文字轉語音（OpenAI、ElevenLabs、Kokoro、Azure、Google；超過 5,000 字自動分段） | 已實作；長文字合併與 WAV 轉檔依賴系統 `ffmpeg`（Vercel 環境未驗證） | `POST /api/tts`、首頁 |
| 瀏覽器內建語音（Web Speech API，不經伺服器） | 已實作 | 首頁 |
| 批次轉換（最多 10 筆；OpenAI／ElevenLabs／Kokoro） | 已實作 | `POST /api/batch` |
| 整本電子書 → 逐章音檔＋章節標記＋ID3 資料＋SRT／VTT 字幕＋進度 | **M1 僅測試模式（Mock 語音）**；TXT／EPUB／文字型 PDF，50MB 上限，不截斷 | `POST /api/audiobook`、`/audiobook` |
| 按字數計量與每月額度（超額回 402，失敗不扣量） | 已實作；額度為測試值 | `GET /api/usage`、`/dashboard` |
| 繁中發音校正詞庫（系統預設＋自訂，合成前套用） | 已實作；管理 UI 屬 M2 | `GET/POST/DELETE /api/lexicon` |
| 使用者自有內容聲明＋產出只限擁有者存取 | 已實作 | `/api/audiobook`、`/api/v1/jobs/*` |
| Podcast 後製（Whisper 逐字稿、章節、摘要、SRT／VTT、ePub） | 部分：音檔 >100KB 不會寫入 KV，背景工作為 fire-and-forget | `POST /api/v1/process` |
| 個人詞彙表（**只用於 Whisper 逐字稿提示，不影響 TTS 發音**） | 已實作 | `/api/glossary` |
| 情緒／角色／預設目錄 | 只有目錄 API，UI 與合成流程未使用 | `GET /api/catalog` |
| 短影音 9:16（依賴 `ffmpeg` 與字型） | 部分 | `POST /api/shorts` |
| NewebPay 訂閱 | **僅測試模式**；價格未設定時無法結帳；未經沙箱端到端驗證（M2） | `/api/billing/*`、`/api/webhook/newebpay` |

不在 M1 範圍：多角色配音、播放／分享頁、Podcast RSS、聲音複製、正式金流、付費 TTS 的自動化呼叫（見 GOAL「Out of scope」）。

## 計費與方案

- **計量單位：字數**。計費字數 = 詞庫套用前的原文，NFC 正規化後去除所有空白與零寬字元的 Unicode 字元數（標點計入）。規則【待 Sean 定案】，詳見 `STATUS.md`。
- **方案一律由伺服器端依訂閱紀錄決定**，用戶端傳入的 `plan`／`tier` 不被採信。
- 方案結構在 [`config/plans.json`](./config/plans.json)，可用環境變數 `BILLING_PLANS_JSON` 覆寫。目前**額度為測試值、所有價格為 `null`（待定）**，程式內不寫死任何價格。

## 測試模式（Mock TTS）

`TTS_PROVIDER=mock` 或 `NODE_ENV=test` 時，所有合成路徑（`/api/tts`、`/api/batch`、`/api/preview`、有聲書）只使用離線 Mock 引擎，不需要也不使用任何引擎金鑰。自動化測試與 CI 一律在測試模式執行，並以「呼叫即拋錯」的 `fetch` stub 確保對外連線為 0。

## 本機開發

需求：Node ≥ 18（CI 用 20）、pnpm 9。只使用 `pnpm-lock.yaml`（不要用 npm／yarn 安裝）。

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local   # 只填自己的測試金鑰；不得 commit
TTS_PROVIDER=mock pnpm dev   # http://localhost:3000，不呼叫付費引擎
```

未設定 Clerk 時為 demo mode：所有訪客共用 `demo-user-001` 身分與額度，資料存在記憶體，重啟即消失。

## 驗證

| 指令 | 內容 |
|---|---|
| `pnpm test` | vitest 單元＋整合測試（測試名稱標 AC 編號） |
| `pnpm run ci` | typecheck → lint → test → build（含 smoke）→ e2e，任一失敗即失敗；GHA `ci` workflow 執行同一指令 |
| `pnpm run scan:secrets` | 機密樣式掃描（有命中即失敗） |

完整清單見 [`SOP.md`](./SOP.md)。

## 環境變數

完整對照見 [`.env.example`](./.env.example)。引擎與服務金鑰**只從環境變數讀取**，不得寫入程式、設定檔或 repo。

| 變數 | 用途 |
|---|---|
| `TTS_PROVIDER` | `mock` 時強制測試模式 |
| `TTS_FALLBACK_ORDER` | 選填；正式模式下跨引擎降級順序（逗號分隔，只納入伺服器有金鑰的引擎） |
| `OPENAI_API_KEY`、`ELEVENLABS_API_KEY`、`KOKORO_API_KEY`、`AZURE_SPEECH_KEY`／`AZURE_SPEECH_REGION`、`GOOGLE_TTS_API_KEY` | TTS 引擎（正式模式） |
| `CLERK_SECRET_KEY`、`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 登入（未設定＝demo mode） |
| `KV_REST_API_URL`、`KV_REST_API_TOKEN` | Vercel KV（未設定＝記憶體後備） |
| `BILLING_PLANS_JSON` | 覆寫方案設定 |
| `NEWEBPAY_MERCHANT_ID`、`NEWEBPAY_HASH_KEY`、`NEWEBPAY_HASH_IV` | NewebPay（M1 只允許測試模式） |
| `AUDIOBOOK_MOCK_MAX_CHARS` | 測試模式單本書字數上限（預設 50,000） |

## 已知限制

- 有聲書音檔在 M1 只暫存在伺服器記憶體（24 小時），私有物件儲存與背景佇列屬 M2。
- 正式引擎的整本轉換、MP3 合併與寫入二進位 ID3 章節標記屬 M2。
- BYOK 引擎金鑰目前以明文存於 KV（M2 改為加密）；企業 API 的 `audioUrl` 尚無 SSRF 防護（M2）。
- 繁中品質、競品比較與價格均未經驗證，對外文案不得宣稱「唯一」「最佳」。
