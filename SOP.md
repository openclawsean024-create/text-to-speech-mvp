# 繁中 TTS 與有聲書工作台 — 開發 SOP

## 規格對齊狀態（2026-11-16）

- ✅ `PRD/SPEC.md` 已依實際程式重建；`GOAL.md` 定義 M1（AC-001～AC-009）。
- 🟡 M1 在分支 `feat/m1` 開發中，進度與證據見 `STATUS.md`。
- ✅ `pnpm install` 失敗（`pnpm-workspace.yaml` 缺 `packages`）已於 AC-001 修正；只保留 `pnpm-lock.yaml`。

## 驗證指令（與 `package.json` scripts 一致）

工作目錄：repo 根目錄。CI 使用 Node 20 + pnpm 9。所有自動化測試在測試模式執行（`NODE_ENV=test`、`TTS_PROVIDER=mock`，`fetch` 被換成呼叫即拋錯的 stub）。

| 類型 | 指令 | 說明 |
|---|---|---|
| 安裝 | `pnpm install --frozen-lockfile` | 只用 `pnpm-lock.yaml` |
| Typecheck | `pnpm run typecheck` | `tsc --noEmit` |
| Lint | `pnpm run lint` | `next lint`（warning 不擋，error 擋） |
| 單元＋整合測試 | `pnpm test` | `vitest run`；可加關鍵字，例 `pnpm test -- billing` |
| Smoke | `pnpm run smoke` | `node scripts/ci-smoke.js`（8 項；`build` 會先跑） |
| Build | `pnpm run build` | `pnpm run smoke && next build` |
| E2E（結構） | `pnpm run e2e` | `node --test e2e/smoke.test.mjs`（需先 build） |
| 完整 CI | `pnpm run ci` | typecheck → lint → test → build → e2e，以 `&&` 串接，任一失敗即失敗；GHA `ci` workflow 執行同一指令 |
| 機密掃描 | `pnpm run scan:secrets` | 有命中即 exit 1；GOAL AC-009 的 `git grep` 指令（見下）結果相同 |
| 開發伺服器 | `TTS_PROVIDER=mock pnpm dev` | http://localhost:3000，不呼叫付費引擎 |
| UI E2E（瀏覽器）／Format | — | 尚未配置 |

GOAL AC-009 機密掃描指令（`sk_l[i]ve_`、`eyJhbGc[i]Oi` 與原樣式比對結果相同，只是避免指令文字比對到自己）：

```bash
git grep -n -I -E "(sk-(proj-)?[A-Za-z0-9_-]{24,}|sk_l[i]ve_|AIza[0-9A-Za-z_-]{30,}|eyJhbGc[i]Oi)" -- . ':!pnpm-lock.yaml' ':!package-lock.json'
```

AC 對應測試：`pnpm test -- ci-config`（AC-001）、`parser`（AC-002）、`tts-provider`（AC-003）、`audiobook.integration`（AC-004）、`billing`（AC-005）、`lexicon`（AC-006）、`access-control`（AC-007）、`tier-guard`（AC-008）、`docs-consistency`（AC-009）。

## 本機開發

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local        # 只填自己的測試金鑰；不得 commit
TTS_PROVIDER=mock pnpm dev
```

- 未設定 Clerk／KV 時為 demo mode，資料存在記憶體，重啟即消失。
- 本機手動試聽真實引擎時只能用個人測試金鑰，輸出與金鑰都不得入庫；自動化測試一律 Mock。

## M1 工作順序（實際執行）

AC-001 → AC-008 → AC-007（存取控制、分享、NewebPay log）→ AC-002 → AC-003 → AC-004（含 AC-007 權利聲明）→ AC-005 → AC-006 → AC-009。每完成一條即更新 `STATUS.md`。

## 故意不做（M1）

- ❌ 真實金流、NewebPay 正式環境、付費 TTS API 的自動化呼叫。
- ❌ 真實個資、客戶資料、受著作權保護的書籍或文章。
- ❌ 正式部署、Vercel／GitHub repo 設定變更、push 到 `master`。
- ❌ 修改、封存或刪除 `ebook-to-audiobook`、`tts-mvp`、`ebook-audio`。

## 已知 blocker

- `ffmpeg` 在 Vercel 執行環境是否可用未驗證，影響正式引擎的長文字合併、WAV、Shorts（M2 前需確認或改方案）。
- 方案單價、字數額度與計費字數規則待 Sean 決定（目前為測試值）。
- 有聲書音檔在 M1 只暫存於伺服器記憶體；私有物件儲存與背景佇列屬 M2。
