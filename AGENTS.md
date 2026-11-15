# AGENTS.md — 繁中 TTS 與有聲書工作台（text-to-speech-mvp）

> 2026-11-16 PRD 重建時改寫：舊版內容中仍正確的規則（不提交 secrets、保留 demo mode、不混用鎖定檔、跨專案邊界、Conventional Commits）已保留；技術棧與指令依實際程式與 `package.json` 修正。

## 1. 權威規格與範圍

- Single Source of Truth：[`PRD/SPEC.md`](./PRD/SPEC.md)（2026-11-16 重建版）與 [`GOAL.md`](./GOAL.md)（M1）。
- 產品：Notion「可產品化商品」的「繁中 TTS 與有聲書工作台」（P2、開發順位第 4）。
- 本 repo 是合併後的主 repo；`ebook-to-audiobook`、`tts-mvp`、`ebook-audio` 只讀，依 SPEC §12 合併清單搬移，不得直接修改、封存或刪除它們。
- 所有實作需能對應 SPEC §5 的 FR 與 GOAL 的 AC；範圍外事項見 GOAL「Out of scope」。

## 2. 專案結構

```
app/                    Next.js App Router 頁面與 API routes
  api/tts|batch|queue|preview|catalog|extract-text|shorts|glossary|keys|usage
  api/billing/*         NewebPay 結帳與訂閱查詢
  api/webhook/*         NewebPay 通知、HMAC 測試
  api/v1/*              企業 API（process、jobs、keys、usage）
  (pages)               /、dashboard、pricing、login、signup、contact、privacy、terms
components/ contexts/ hooks/ locales/   UI、狀態、Clerk 包裝、i18n
lib/                    tts-engines.js、tts-prompts.js、whisper.js、post-process.js、epub.js、
                        shorts.js、newebpay.js、webhook.js、db.ts、jobs.ts、api-keys.ts、
                        glossary.ts、subscriptions.ts、voices.ts、rate-limits.ts
scripts/ci-smoke.js     模組載入 smoke 測試
scripts/secret-scan.mjs 機密樣式掃描（pnpm run scan:secrets）
tests/                  vitest 單元／整合測試（測試名稱標 AC 編號）、fixtures（自編短文）
e2e/smoke.test.mjs      建置後結構檢查（node:test）
PRD/                    SPEC.md、CHANGELOG.md
api/、index*.html、landing.html、pricing.html、dashboard.html   舊版遺留檔（推定未部署，勿新增依賴）
```

M1 新增：`lib/audiobook/`（parser、extract、epub-reader、audio、subtitles、pipeline、jobs、service）、`lib/tts/`（provider、synthesis、Mock）、`lib/billing/`（方案、字數、額度）、`lib/lexicon/`、`lib/identity.ts`、`lib/access-control.ts`、`lib/rights.ts`、`lib/share.ts`、`config/plans.json`。

## 3. 技術棧

- Next.js 14（App Router）、React 18、TypeScript（部分 `lib/*.js` 為 CommonJS）、Tailwind CSS 3。
- Node ≥18（`package.json` engines；CI 用 Node 20）、pnpm 9。
- 認證：Clerk（`@clerk/nextjs`，未設定時 demo mode）。資料：Vercel KV（未設定時記憶體後備）。
- TTS：OpenAI、ElevenLabs、Kokoro（inference.sh）、Azure、Google（皆 REST）；後製：OpenAI Whisper／Groq、GPT。
- 金流：NewebPay（`lib/newebpay.js`，未設定 production 環境時指向測試端點）。
- 文件解析：epubjs、pdf-parse、mammoth。長文字合併、WAV、Shorts 依賴系統 `ffmpeg`。
- 部署：Vercel（`vercel.json` buildCommand `pnpm run ci`）。

## 4. 開發規則

- **只用假資料**：fixture、範例、截圖、log 只能使用明顯虛構的內容（例：`demo-user-001`、`test@example.com`、自編示範文章）。不得放入真實個資、客戶資料或受著作權保護的書籍／文章。
- **不得提交憑證**：`.env`、`.env.local`、`.env*.local` 不入庫；API key、KV token、NewebPay HashKey/HashIV、Clerk secret、`WEBHOOK_SECRET` 只走環境變數。若發現 repo 內疑似憑證，不要複製，回報檔案路徑由 Sean 處理（輪替金鑰屬人審事項）。
- **測試不可為了通過而刪改斷言**：測試失敗時修正程式；若斷言本身錯誤，需在 PR 說明理由並經 Sean 同意。`e2e/smoke.test.mjs` 會檢查 `PRD/SPEC.md` 標題含「規格計劃書 v3.0.2」與「v3.0.2 改版摘要」，改 SPEC 標題前先處理測試並取得同意。
- **測試與 CI 不呼叫付費 TTS／LLM API**：一律使用 Mock provider；真實金流、正式引擎呼叫列為 M1 範圍外。
- **保留 demo mode**：未設定 Clerk／KV 也要能跑；寫入路徑需有記憶體後備並在文件註明。
- **方案、tier、額度由伺服器端決定**，不得信任用戶端傳入值。
- **不混用鎖定檔**：只保留 `pnpm-lock.yaml`（`package-lock.json` 已於 M1 AC-001 移除，理由見 STATUS.md），改依賴只動 `package.json` 並用 pnpm 安裝。
- **不擅自加 CI 步驟**：`pnpm run ci` 為單一進入點；新增檢查先寫入 `package.json` script 並更新 `SOP.md`。
- **不 commit build 產物**：`.next/`、`node_modules/`、`*.log`、`.vercel/`；`tsconfig.tsbuildinfo` 已被追蹤，移除需另開 PR。
- **跨專案邊界**：不與其他專案共用 deploy pipeline、認證或 KV namespace。
- 不得在 agent session 內 push 到 `master`、merge、部署、改 repo 設定或輪替 secrets；auth、金流、個資、資料遷移相關變更需 Sean 人審。

## 5. 驗證命令

完整清單與現況見 [`SOP.md`](./SOP.md)。交付前至少：`pnpm install --frozen-lockfile`、`pnpm run ci`（= typecheck → lint → test → build（含 smoke）→ e2e）、`pnpm run scan:secrets`。

## 6. Commit 規則

Conventional Commits：`<type>(scope): <說明或 FR／AC 編號>`，例如 `feat(audiobook): port parser (AC-002)`、`docs: rebuild PRD`。一次邏輯改動一個 commit。
