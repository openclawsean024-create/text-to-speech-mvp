# Goal — 繁中 TTS 與有聲書工作台 M1

## Objective

把 `ebook-to-audiobook`、`tts-mvp`、`ebook-audio` 中仍有價值的功能收斂進 `text-to-speech-mvp`，成為單一產品；在**全程測試模式**（Mock TTS、假資料、無真實金流）下完成「電子書 → 章節 → 逐章語音 → 字幕」流程、按字數計量與額度、繁中發音校正詞庫，並讓 CI 恢復可重跑的綠燈。規格依據：[`PRD/SPEC.md`](./PRD/SPEC.md) §5、§9、§12。

## Acceptance criteria

- AC-001：**CI 可重跑**。修正 `pnpm-workspace.yaml` 缺 `packages` 欄位導致 `pnpm install` 失敗的問題，並新增 `pnpm test`（單元＋整合測試）納入 `pnpm run ci`。
  驗證：乾淨 clone 執行 `pnpm install --frozen-lockfile && pnpm run ci && pnpm test` 全部 exit 0；PR 上的 GHA `ci` workflow 綠燈（附 run 連結）。
- AC-002：**電子書解析併入（合併）**。將 EB `src/lib/engine/parser.ts` 移植為主 repo `lib/audiobook/parser.ts`，原 `parser.test.ts` 的案例一併移植且全數通過；有聲書路徑不再套用 `/api/extract-text` 的 5,000 字截斷。
  驗證：`pnpm test -- parser` exit 0；測試含一份自製假內容 TXT fixture（≥3 個「第N章」）切出正確章數，以及 >50MB 與錯誤簽章檔案被拒。
- AC-003：**TTS 測試模式（合併）**。移植 EB 的 `TtsProvider` 介面、`TtsOrchestrator` 與 `MockTtsProvider`，主 repo 既有 5 引擎包裝為 provider；`TTS_PROVIDER=mock` 或 `NODE_ENV=test` 時所有合成路徑（`/api/tts`、`/api/batch`、有聲書流程）只用 Mock。
  驗證：`pnpm test -- tts-provider` exit 0；測試中將 `global.fetch` 換成「呼叫即拋錯」的 stub，跑完全部合成測試仍通過，證明對付費 TTS 網域外呼次數為 0。
- AC-004：**有聲書轉換流程（Mock）（合併）**。在主 repo 以搬入的模組（parser、Mock TTS、`audio.ts` 章節標記與命名、`subtitles.ts` SRT/VTT）重寫轉換流程：每個片段只合成一次，產出逐章音檔、章節標記、字幕與進度狀態。
  驗證：`pnpm test -- audiobook.integration` exit 0；以 3 章假內容 fixture 斷言：3 個章節輸出、檔名符合 `{slug}-chapter-XX`、SRT 與 VTT 各至少 1 段、Mock provider 的呼叫次數等於片段數（無重複合成）。
- AC-005：**按字數計費（計量與額度）**。每次成功合成依 SPEC §14-2 的「計費字數」定義記錄每月用量；額度依伺服器端訂閱方案判斷，超額回 HTTP 402；`/api/usage` 回傳本月字數、上限、剩餘。失敗的合成不計字數。方案單價與額度數值以設定檔提供，數值待 Sean 決定前用測試值。
  驗證：`pnpm test -- billing` exit 0；涵蓋：計數規則（含全形標點、英數、空白的固定案例）、額度剛好用完、超額 402、合成失敗不扣量、跨月重置。
- AC-006：**繁中發音校正詞庫**。新增系統預設＋使用者自訂詞庫（詞條：原詞、替代讀法文字，可選 Azure 用拼音／注音），合成前以最長匹配套用於所有引擎；提供 `GET/POST/DELETE` 詞庫 API（Clerk 未設定時用 demo 使用者）。計費字數以套用前原文計算。
  驗證：`pnpm test -- lexicon` exit 0；涵蓋：最長匹配優先、同句多詞條、不重疊替換、使用者詞條覆蓋系統詞條、Mock provider 收到的是替換後文字、字數計量仍以原文為準。fixture 只用自編示範詞條。
- AC-007：**使用者自有內容聲明與產出存取控制**。電子書上傳請求須帶 `rightsConfirmed: true`，否則回 400；聲明與時間戳記隨工作保存。工作狀態與下載端點只允許擁有者（Clerk userId 或該 API key）存取，移除「建立後 24 小時／30 天內可匿名讀取」的放行；分享功能不得把原文放進 URL。
  驗證：`pnpm test -- access-control` exit 0；涵蓋：未聲明 400、他人 userId 403、匿名 401／403、擁有者 200。
- AC-008：**方案與 tier 由伺服器端決定**。`/api/tts` 的 `plan`、`/api/glossary` 的 `tier`、`/api/usage` 的 `plan` 查詢參數不再採信用戶端值；`/api/v1/keys` 不得在無對應有效訂閱時建立付費 tier key。
  驗證：`pnpm test -- tier-guard` exit 0；涵蓋：用戶端傳 `plan: "pro"` 仍以 free 額度判斷、匿名建立 `business` key 被拒。
- AC-009：**合併紀錄與文件一致**。`STATUS.md` 合併清單每列標示完成狀態；`SOP.md` 指令與 `package.json` 一致；README 修正 SPEC §13 所列不實描述；repo 內無真實個資、憑證與受著作權保護的測試書籍。
  驗證：`git grep -n -I -E "(sk-(proj-)?[A-Za-z0-9_-]{24,}|sk_l[i]ve_|AIza[0-9A-Za-z_-]{30,}|eyJhbGc[i]Oi)" -- . ':!pnpm-lock.yaml' ':!package-lock.json'` 無輸出；`git diff --stat master...` 中沒有任何 `.epub`、`.pdf` 書籍檔；Sean 對照 STATUS 合併清單逐項覆審。

## Out of scope

真實金流交易與 NewebPay 正式環境（沙箱端到端屬 M2）；付費 TTS API 的正式呼叫（M1 所有測試與 CI 一律 Mock，真實 key 只在本機手動試聽且不得入庫）；真實個資、客戶資料、受著作權保護書籍；正式部署與 Vercel／GitHub 設定變更；Supabase 移植；聲音複製（FR-027）；多角色配音（FR-010，M2）；播放頁、公開分享與 RSS（M2／M3）；私有物件儲存與背景佇列（M2）；封存、改名或刪除被併入的 repo；Next.js 版本升級。

## Exit gate

M1 完成前需由 Sean 覆審 scope 與合併清單，AC-001～AC-009 的驗證指令在乾淨環境全數 exit 0 並附輸出紀錄，PR 上 GHA `ci` 綠燈；未通過不得進入 M2 的沙箱金流、正式引擎呼叫或任何 production release。測試不可為了通過而刪改既有斷言。
