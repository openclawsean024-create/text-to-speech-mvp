# Hermes TTS — text-to-speech-mvp

## 目標
建立並維運 **Hermes TTS v3.0** —— 一個 Next.js 14 SaaS，定位為「繁體中文唯一的 AI 雙引擎」產品，提供：
1. **TTS 統一介面** —— 聚合 5 個 TTS 引擎（OpenAI gpt-4o-mini-tts、ElevenLabs Multilingual v2、Kokoro、Azure Neural TTS、Google Cloud TTS），繁中 UI + 12 情緒 × 12 角色 × 12 預設 + 一鍵直出 YouTube Shorts 9:16。
2. **Podcast 後製工廠** —— 上傳 MP3/WAV（≤ 500MB），自動跑 Whisper 繁中逐字稿 + GPT 章節命名 + SRT/VTT 字幕 + 三段摘要 + ePub 文字稿 + 個人詞彙表。
3. **企業 API（NT$2,999/月）** —— `POST /api/v1/process` + HMAC 簽章 webhook 回傳 + tier-based rate limit + SHA-256 hashed API key。

最終交付一個可部署在 Vercel、以藍新金流（NewebPay）收費、Clerk 認證、可在 demo mode 退化的繁中 SaaS 成品。詳見 [`PRD/SPEC.md`](./PRD/SPEC.md) 與 [`README.md`](./README.md)。

## 避免
- **不要把 secrets / API keys 寫進 repo**。`.env`、`.env.local`、`.env*.local` 必須留在 git 之外；真實金流簽章、API key、KV token 只走 Vercel env。
- **不要把 build 產物 commit 進來**：`.next/`、`node_modules/`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`tsconfig.tsbuildinfo`、`*.log`、`.vercel/` 都應忽略（目前 `.gitignore` 已含，但 `tsconfig.tsbuildinfo` 之前已入庫追蹤，新增忽略規則要小心 `git rm --cached`）。
- **不要擅自加測試之外的 CI 步驟**。`pnpm run ci` = `typecheck + lint + smoke + build` 是單一進入點，新流程先併入 `scripts/ci-smoke.js` 再驗。
- **不要破壞 demo mode**。沒設 Clerk / KV 也要能跑；所有寫入路徑都要有記憶體後備，並在文件或 commit message 註明。
- **不要混用 `pnpm-lock.yaml` 與 `package-lock.json`**。此專案目前兩份鎖定檔並存（pnpm 推薦），改依賴只動 `package.json` 並用 pnpm 安裝；不要把 npm 行為偷偷帶進 CI。
- **不要把 webhook secret / NewebPay CheckValue 寫死在程式碼**。HMAC、AES-CBC key、CheckValue 一律走環境變數。
- **不要在 PR/branch 上覆寫整份 AGENTS.md**。要改就在小節內追加，並用 `docs: revise AGENTS.md (overrides ...)` 標註。
- **跨專案邊界**：本專案是 `text-to-speech-mvp` 自己一條線，與同 workspace 的 `agent-orchestrator` / `beauty-crm` / `meeting-recorder` **不共用** deploy pipeline / 認證 / KV namespace。

## 技術棧與指令
- **框架**：Next.js 14（App Router）+ TypeScript + Tailwind CSS
- **Runtime**：Node ≥ 18（package.json `engines`）
- **套件管理**：pnpm（推薦）
- **核心依賴**：`next ^14.2`、`react ^18.3`、`openai ^4.86`、`@clerk/nextjs ^6.12`、`@vercel/kv ^3.0`、`epubjs`、`lucide-react`、`mammoth`、`pdf-parse`
- **第三方服務**：OpenAI（TTS + Whisper + GPT-4o-mini）、ElevenLabs、Kokoro、Azure、Google Cloud TTS、NewebPay（藍新金流）、Clerk、Vercel KV
- **目錄重點**：
  - `app/` —— Next.js 頁面 + `api/` 路由（含 `api/tts/`、`api/v1/process/`、`api/v1/keys/`、`api/shorts/`、`api/glossary/`、`api/billing/`、`api/webhook/newebpay/`）
  - `lib/` —— `tts-engines.js`、`tts-prompts.js`、`whisper.js`、`post-process.js`、`epub.js`、`shorts.js`、`api-keys.ts`、`webhook.js`、`jobs.ts`、`glossary.ts`、`newebpay.js`、`subscriptions.ts`
  - `components/`、`contexts/`、`hooks/`、`locales/` —— UI / i18n
  - `PRD/SPEC.md` —— v3.0 完整規格（24 區塊）
  - `docs/` —— `BUILD-SUMMARY.md`、`CI.md`、`DEPLOYMENT.md`、`screenshots/`
  - `scripts/ci-smoke.js` —— CI smoke 測試
- **常用指令**（`pnpm`）：
  - `pnpm install` —— 安裝依賴
  - `cp .env.example .env` 並編輯 —— 至少填 `OPENAI_API_KEY`
  - `pnpm dev` —— 啟動 dev server（http://localhost:3000）
  - `pnpm build` —— 生產建置（會先跑 `pnpm run smoke`）
  - `pnpm start` —— 啟動生產 server
  - `pnpm typecheck` —— `tsc --noEmit`
  - `pnpm lint` —— `next lint`
  - `pnpm run smoke` —— `node scripts/ci-smoke.js`
  - `pnpm run ci` —— `typecheck && lint && smoke && build`（完整 CI）
- **部署**：Vercel，`vercel.json` 已設定；`pnpm run build` 為 buildCommand；live: https://text-to-speech-mvp.vercel.app
- **Git**：Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:` / `ci:`）；一次邏輯改動 = 一次 commit；交付前 `pnpm run ci` 必須 100% 綠。
