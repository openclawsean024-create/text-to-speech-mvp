# 文字轉語音 MVP — CHANGELOG

> 規格書版本沿革。所有 breaking change、infra 升級、市場決策都記錄於此。

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
