# 文字轉語音 MVP — CHANGELOG

> 規格書版本沿革。所有 breaking change、infra 升級、市場決策都記錄於此。

---

## Unreleased — M1（分支 `feat/m1`，2026-11-16）

> 依 `GOAL.md` AC-001～AC-009。全程測試模式（Mock TTS、假資料、無真實金流）。

### Fixed
- `pnpm-workspace.yaml` 補 `packages: ['.']`：修正 `pnpm install` 以 `packages field missing or empty` 失敗、GHA `ci`／`deploy` 長期紅燈（AC-001）。
- 方案／tier 改由伺服器端決定：`/api/tts`、`/api/batch` 的 `plan`、`/api/glossary` 的 `tier`、`/api/usage?plan=` 不再採信；`/api/v1/keys` 匿名 401、無對應訂閱不得建立付費 tier key（AC-008）。
- `/api/v1/jobs/[id]` 與 `/download` 移除「建立後 24 小時／30 天可匿名讀取」，只允許擁有者（AC-007）。
- 分享連結不再把原文放進 URL（AC-007）。
- NewebPay 通知不再把解密後的完整交易寫進 log；M1 鎖定測試模式；金額改由方案設定提供。
- `/api/extract-text` 錯誤訊息的大小上限改為實際的 10MB。

### Added
- vitest 測試框架與 `pnpm test`、`pnpm run e2e`、`pnpm run scan:secrets`；`pnpm run ci` = typecheck → lint → test → build → e2e（AC-001）。
- 自 `ebook-to-audiobook` 移植：parser（AC-002）、TTS provider 介面／Orchestrator／Mock（AC-003）、audio、subtitles（AC-004）及其測試。
- `lib/tts/synthesis.ts`：所有合成路徑的單一入口，測試模式只用 Mock（AC-003）。
- 有聲書轉換：`/api/audiobook`（＋狀態、下載）、`/audiobook` 頁面；每片段只合成一次，產出逐章音檔、章節標記、ID3 資料、依合成時序的 SRT／VTT、進度（AC-004）。
- 按字數計量與每月額度、可設定的方案結構 `config/plans.json`（價格待定）（AC-005）。
- 繁中發音校正詞庫 `lib/lexicon`、`/api/lexicon`，與 Whisper 詞彙表分開（AC-006）。
- 使用者自有內容聲明（`rightsConfirmed`，版本與時間戳記隨工作保存）（AC-007）。

### Removed
- `package-lock.json`（只保留 `pnpm-lock.yaml`）。
- 首頁與控制台的用戶端方案選擇器；定價頁寫死的價格。

---

## v3.0.2 — 2026-09-06（批次 C fleet infra upgrade）

### Added
- 新增 `PRD/CHANGELOG.md`（本檔）
- 新增 `e2e/smoke.test.mjs`：以 Node 內建 `node:test` 對 Next.js 19 條路由 + Hermes 引擎 + 7 個核心 lib 模組做結構性 E2E
- 新增 `e2e/` 目錄與 `e2e/README.md` 說明

### Changed
- `PRD/SPEC.md`：標頭升級至 v3.0.2；新增 §0.1 v3.0.2 改版摘要
  - 主體內容（§0–§15）不變
- `.github/workflows/deploy.yml`：`branches: [main]` → `branches: [master]`
  - 原因：此 repo production branch 為 `master`，舊檔從未實際觸發 deploy
- `.github/workflows/ci.yml`：補上 `workflow_dispatch` trigger，便於手動觸發

### Verified
> 2026-11-16 補註：下列為當時本機紀錄。GHA 上 `master` 的 `ci` 實際在 `pnpm install` 階段失敗（`packages field missing or empty`），見 SPEC §13；已於 M1（AC-001）修正。

- `pnpm run typecheck`（`tsc --noEmit`） ✅
- `pnpm run lint`（`next lint`） ✅ 0 error（3 warning，未擋 CI）
- `pnpm run smoke`（`scripts/ci-smoke.js`） ✅ 8/8 passed
- `pnpm run build`（Next.js 14 + Turbopack） ✅ 19 routes
- `node --test e2e/smoke.test.mjs` ✅

### Notes
- `master` 為唯一 production branch
- Deploy 仍走 Vercel（Next.js 14 + Vercel 是原生支援鏈）
- 既有的 `pnpm run ci` 入口點（typecheck + lint + smoke + build）不變；AGENTS.md 定義的單一 CI 原則維持

---

## v3.0 — 2026-07-19（forced upgrade：TTS 介面 × Hermes 雙引擎）

詳見 `PRD/SPEC.md` §0。摘要：

- 從 v2.2.2 的「後製 only」升級為「**TTS 介面 + 後製**」雙甜蜜點
- 5 個頂級 TTS 引擎聚合（OpenAI / ElevenLabs / Kokoro / Azure / Google）
- 12 情緒 × 12 角色 × 12 預設 + YouTube Shorts 9:16 直出
- 商業化 = 30 + 7.0×7 = 79/100
