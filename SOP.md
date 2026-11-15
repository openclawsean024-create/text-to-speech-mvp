# 繁中 TTS 與有聲書工作台 — 開發 SOP

## 規格對齊狀態（2026-11-16）

- ✅ `PRD/SPEC.md` 已依實際程式重建；`GOAL.md` 定義 M1（AC-001～AC-009）。
- ⚠️ 本次只改文件，尚未開始 M1 開發。
- ⚠️ GHA `ci` 在 `master` 最近 3 次（2026-09-05～09-06）皆失敗：`pnpm install --frozen-lockfile` 報 `packages field missing or empty`（`pnpm-workspace.yaml` 只有 `allowBuilds`、沒有 `packages`）。`deploy.yml` 同一原因失敗。

## 驗證指令（依 `package.json` scripts 查證）

工作目錄：repo 根目錄。CI 使用 Node 20 + pnpm 9。

| 類型 | 指令 | 狀態 |
|---|---|---|
| 安裝 | `pnpm install --frozen-lockfile` | ⚠️ 目前失敗（見上）；M1 AC-001 修正 |
| Typecheck | `pnpm run typecheck`（`tsc --noEmit`） | 已配置 |
| Lint | `pnpm run lint`（`next lint`） | 已配置；目前有 warning、無 error |
| Smoke | `pnpm run smoke`（`node scripts/ci-smoke.js`，8 項） | 已配置 |
| Build | `pnpm run build`（先跑 smoke 再 `next build`） | 已配置 |
| E2E（結構） | `node --test e2e/smoke.test.mjs`（需先 build） | 已配置；無對應 npm script |
| 完整 CI | `pnpm run ci`（typecheck → lint → smoke → build → e2e 結構測試） | 已配置；受安裝問題阻擋 |
| 開發伺服器 | `pnpm dev`（http://localhost:3000） | 已配置 |
| 單元測試 | `pnpm test` | **尚未配置**（M1 AC-001） |
| 整合測試（API route + Mock TTS） | — | **尚未配置**（M1 AC-003、AC-004） |
| UI E2E（瀏覽器） | — | **尚未配置** |
| Format | — | **尚未配置** |
| 機密掃描 | `git grep -n -I -E "(sk-(proj-)?[A-Za-z0-9_-]{24,}\|sk_live_\|AIza[0-9A-Za-z_-]{30,}\|eyJhbGciOi)" -- . ':!pnpm-lock.yaml' ':!package-lock.json'` | 手動指令，非 script；預期無輸出 |

### 2026-11-16 本機實測紀錄（文件重建時，於 repo 的暫存副本執行，未改動 repo）

| 指令 | 結果 |
|---|---|
| `pnpm install --frozen-lockfile`（原樣） | exit 1：`packages field missing or empty` |
| 暫時移除副本中的 `pnpm-workspace.yaml` 後 `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm run smoke` | exit 0（8 passed） |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0（47 個 warning） |
| `pnpm run build`（`NEXT_PUBLIC_DEMO_MODE=true`、placeholder `OPENAI_API_KEY`） | exit 0 |
| `node --test e2e/smoke.test.mjs` | exit 0（11 passed；含本次新版 `PRD/SPEC.md`） |

> 本機使用 Node 26（非 CI 的 Node 20），結果僅供參考；以 PR 上 GHA run 為準。移除 `pnpm-workspace.yaml` 只是驗證手段，正式修法（補 `packages` 或改用其他設定）在 M1 AC-001 由開發者決定並經 Sean 覆審。

## 本機開發

```bash
pnpm install --frozen-lockfile   # 目前需先處理 AC-001
cp .env.example .env.local        # 只填自己的測試金鑰；不得 commit
pnpm dev
```

- 未設定 Clerk／KV 時為 demo mode，資料存在記憶體，重啟即消失。
- 本機手動試聽真實引擎時只能用個人測試金鑰，輸出與金鑰都不得入庫；自動化測試一律 Mock。

## M1 工作順序（對應 `GOAL.md`）

1. AC-001：修安裝問題、加入測試框架與 `pnpm test`，讓 CI 綠燈。
2. AC-003：搬入 TTS provider 介面與 Mock，先讓所有合成路徑可離線測試。
3. AC-002：搬入 parser 與測試。
4. AC-004：重寫有聲書流程（Mock），搬入 audio／subtitles。
5. AC-008 → AC-005：先封住用戶端指定方案，再做字數計量與額度。
6. AC-006：發音校正詞庫。
7. AC-007：自有內容聲明與存取控制。
8. AC-009：更新 STATUS 合併清單、README、跑機密掃描，交 Sean 覆審。

## 故意不做（M1）

- ❌ 真實金流、NewebPay 正式環境、付費 TTS API 的自動化呼叫。
- ❌ 真實個資、客戶資料、受著作權保護的書籍或文章。
- ❌ 正式部署、Vercel／GitHub repo 設定變更、push 到 `master`。
- ❌ 修改、封存或刪除 `ebook-to-audiobook`、`tts-mvp`、`ebook-audio`。

## 已知 blocker

- 安裝失敗導致 CI 與 deploy workflow 全紅（AC-001）。
- `ffmpeg` 在 Vercel 執行環境是否可用未驗證，影響長文字合併、WAV、Shorts（M2 前需確認或改方案）。
- 方案單價與字數額度待 Sean 決定（AC-005 先用測試值）。
