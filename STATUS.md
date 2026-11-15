# Status — 繁中 TTS 與有聲書工作台（text-to-speech-mvp）

- State：🟢 **M1 完成（合併清單 Sean 已覆審通過）**（分支 `feat/m1`，自 `chore/prd-rebuild` 分出；2026-11-16）。驗證輸出摘要見 `SOP.md`「M1 驗證紀錄」。
- 本次性質：文件重建（`PRD/SPEC.md`、`GOAL.md`、`AGENTS.md`、`SOP.md`、`STATUS.md`），未修改任何功能程式碼、設定或測試。
- 基準 commit：`master` @ `96b2eac`；文件分支 `chore/prd-rebuild`（Draft PR）。

## M1 進度（GOAL AC-001～AC-009）

| AC | 內容 | 狀態 | 測試（`pnpm test -- <關鍵字>`） | 證據 |
|---|---|---|---|---|
| AC-001 | CI 可重跑 | ✅ 完成（[GHA ci 綠燈](https://github.com/openclawsean024-create/text-to-speech-mvp/actions/runs/43757534562)） | `ci-config`（`tests/unit/ci-config.test.ts`，5 案例） | `pnpm install --frozen-lockfile` exit 0；`pnpm run ci` exit 0 |
| AC-002 | 電子書解析併入 | ✅ 完成 | `parser`（`tests/unit/parser.test.ts` 27 案例＝EB 原測試全數移植；`tests/unit/parser-book-file.test.ts` 18 案例） | `lib/audiobook/parser.ts` 函式本體與 EB 相同；自製 TXT fixture 切出 3 章；>50MB 413、錯誤簽章 415；12,000 字內容不截斷；另支援 EPUB（含 DRM 拒絕）與文字型 PDF |
| AC-003 | TTS 測試模式 | ✅ 完成 | `tts-provider`（`tests/unit/tts-provider.test.ts` 26 案例；`tests/integration/tts-provider.routes.test.ts` 9 案例） | `global.fetch` 為呼叫即拋錯的 stub、`lib/tts-engines` 換成拋錯間諜；`/api/tts`（5 引擎）、`/api/batch`、`/api/preview` 全部通過，外呼 0 次 |
| AC-004 | 有聲書轉換流程（Mock） | ✅ 完成 | audiobook.integration（tests/integration/audiobook.integration.test.ts，18 案例）；audio（14）、subtitles（9）為 EB 測試移植 | 3 章 fixture：3 個章節輸出、檔名 {slug}-chapter-XX、SRT／VTT 各 ≥1 段、Mock 呼叫次數＝片段數；進度 done 100%；中途失敗不重試 |
| AC-005 | 按字數計量與額度 | ✅ 完成（計費字數規則與額度數值【待 Sean 定案】） | billing（tests/unit/billing.test.ts 27 案例；tests/integration/billing.routes.test.ts 11 案例） | 固定計數案例（全形標點、英數、空白、零寬、emoji、NFC）；剛好用完 200、超額 402、合成失敗不扣量、跨月重置；/api/usage 回傳本月字數／上限／剩餘 |
| AC-006 | 繁中發音校正詞庫 | ✅ 完成 | lexicon（tests/unit/lexicon.test.ts 10 案例；tests/integration/lexicon.routes.test.ts 8 案例） | 最長匹配、同句多詞條、不重疊、使用者覆蓋系統；Mock 收到替換後文字、計費以原文計；/api/tts、/api/batch、/api/audiobook 皆套用；與 Whisper 詞彙表（glossary:）資料分開 |
| AC-007 | 自有內容聲明與存取控制 | ✅ 完成 | access-control（tests/integration/access-control.test.ts，16 案例）、share-link（5 案例） | 未聲明 400、他人 userId 403、匿名 401、擁有者 200（/api/v1/jobs 與 /api/audiobook 皆同）；聲明版本與時間戳記隨工作保存；分享連結只含設定參數 |
| AC-008 | 方案與 tier 由伺服器端決定 | ✅ 完成 | `tier-guard`（`tests/integration/tier-guard.test.ts`，12 案例） | `/api/tts`、`/api/batch` 的 `plan`、`/api/glossary` 的 `tier`、`/api/usage?plan=` 皆不採信；`/api/v1/keys` 匿名 401、無訂閱建立付費 tier 403 |
| AC-009 | 合併紀錄與文件一致 | ✅ 完成（合併清單 Sean 已覆審通過，2026-11-16） | docs-consistency（tests/unit/docs-consistency.test.ts，9 案例） | 機密掃描 0 筆（scan:secrets 與 GOAL git grep）；無 .epub／.pdf；SOP 指令與 package.json 一致；README 移除 SPEC §13 不實描述；CHANGELOG 新增 M1 並更正 v3.0.2 綠燈描述 |

### AC-001 決策紀錄

- **`pnpm-workspace.yaml`**：補上 `packages: ['.']`。pnpm 9 只要偵測到 workspace 檔就要求 `packages` 非空，原檔只有 `allowBuilds`，導致 `pnpm install` 與所有 `pnpm` 指令以 `packages field missing or empty` 失敗。保留原有 `allowBuilds` 清單不動。
- **Lockfile：只保留 `pnpm-lock.yaml`，刪除 `package-lock.json`**。理由：(1) GHA `ci.yml`／`deploy.yml`、`vercel.json` 的 `buildCommand` 與 `AGENTS.md` 都以 pnpm 為唯一套件管理器；(2) `package-lock.json` 從未被任何流程使用，兩份鎖定檔並存時實際安裝版本會與 npm 鎖定檔漂移，造成「本機可跑、CI 失敗」；(3) 新增測試框架後只需要維護一份鎖定檔。
- **測試框架**：vitest 2（與 `ebook-to-audiobook` 相同，方便移植測試）。`pnpm test` = `vitest run`；設定在 `vitest.config.mts`，`tests/setup.ts` 把 `global.fetch` 換成呼叫即拋錯的 stub。
- **`pnpm run ci`** = `typecheck && lint && test && build && e2e`，以 `&&` 串接，任一階段失敗即失敗；`build` 內含原有的 `smoke`。新增 `pnpm run e2e`（原本沒有對應 script）。
- **GHA `ci.yml`**：job 名稱與註解更新；`OPENAI_API_KEY` 改為固定占位字串、不再讀取 repo secret（CI 不需要也不應該拿到真實金鑰），並加上 `TTS_PROVIDER=mock`。
- ⚠️ **合併後的連帶影響**：`deploy.yml` 與 `ci.yml` 是同一個安裝問題而失敗；本 PR 合併到 `master` 後 `deploy.yml` 會恢復運作並嘗試 `vercel --prod` 部署。是否要合併、何時部署由 Sean 決定（本次未改動 `deploy.yml`）。

### AC-005 決策紀錄（待 Sean 定案）

- **計費字數規則（沿用 GOAL／SPEC §14-2 預設，⚠️ 待 Sean 定案）**：以詞庫套用與正規化**之前**的原文計算；先 Unicode NFC 正規化；去除所有空白（半形／全形空白、Tab、換行、NBSP）與零寬字元；其餘每個 Unicode 碼位計 1 字——中文、英數、半形與全形標點、符號、emoji 都計入。「標點是否計入」目前為**計入**。規則版本 `m1-default-2026-11`（`lib/billing/char-count.ts`），固定案例見 `tests/unit/billing.test.ts`。
- **計費月份**：UTC 的 YYYY-MM（每月 1 日 00:00 UTC 重置；是否改台灣時間 ⚠️ 待 Sean 定案）。
- **流程**：合成前先佔用額度（`used + 字數 ≤ 上限` 才放行，剛好用完允許），成功才確認、失敗退回；超額回 HTTP 402 `CHAR_QUOTA_EXCEEDED`。各引擎字數另外記錄以便對帳。
- **方案結構**：`config/plans.json`（free／personal／creator／business／custom），**額度為測試值、所有 `price` 為 `null`（待定）**；可用環境變數 `BILLING_PLANS_JSON` 整份覆寫。NT$ 三層或 USD 兩層 ⚠️ 待 Sean 決定；價格未設定時 `/api/billing/checkout` 回 503，定價頁顯示「待定」。
- 計量資料在 Vercel KV（未設定時為記憶體後備，重啟即遺失，不可用於正式計費）。

## 與 Notion 商品資料庫的對應

| Notion「可產品化商品」欄位 | 值 | 本 repo 對應 |
|---|---|---|
| 產品名稱 | 繁中 TTS 與有聲書工作台 | 本 repo（主 repo） |
| 優先順序 | **P2** | — |
| 開發順位 | 第 4 個 | — |
| 主 repo | openclawsean024-create/text-to-speech-mvp（`master`） | ✅ |
| 要併入的 repo | ebook-to-audiobook、tts-mvp、ebook-audio | SPEC §12 合併清單 |
| 獲利潛力／模式 | 中；SaaS 訂閱、免費增值 | SPEC §2 |
| 目標客群 | Podcaster、自媒體、出版社、企業內訓錄製 | SPEC §2 |
| 現況完成度 | 65（Notion 記載） | 程式盤點見下表；本次未重新評分 |
| 上市前要補 | 合併成單一產品、補測試、按字數計費、繁中發音校正詞庫 | GOAL AC-001～AC-006 |
| 主要風險 | TTS 引擎成本與條款變動；電子書版權限使用者自有內容 | SPEC §8；GOAL AC-007 |

## 目前狀態

- 主 repo：多引擎 TTS、瀏覽器語音、檔案抽文字、批次、Podcast 後製管線、NewebPay 後端、企業 API 已有程式，但多處為「部分」：抽文字截斷 5,000 字、計量以次數且方案由用戶端指定、匿名可讀他人工作、無單元測試。
- `ebook-to-audiobook`：有章節切分、角色偵測、Mock TTS、章節標記、字幕、RSS 等純 TS 模組與 107 個通過的 vitest 案例（另 1 個 e2e 檔需先 build），但轉換 API 未使用這些模組，且有重複合成等缺陷。
- `tts-mvp`、`ebook-audio`：只有通用儀表板樣板與 PRD，無可搬移的功能程式。
- CI：`master` 的 `ci` 與 `Deploy to Vercel` workflow 最近皆失敗（安裝階段）；`ebook-to-audiobook` 的 CI 也失敗（e2e 需 `.next/`）。

## FR 對照（詳見 SPEC §5）

| 狀態 | FR |
|---|---|
| 已實作 | FR-001 單段多引擎 TTS、FR-002 瀏覽器語音、FR-014 聲音清單與試聽、FR-023 Whisper 詞彙表、FR-028 中英介面 |
| 部分 | FR-003 長文分段合併、FR-004 MP3/WAV、FR-005 文件抽文字、FR-006 章節切分（EB）、FR-007 整本轉換（EB）、FR-008 章節標記（EB）、FR-009 合成字幕（EB）、FR-010 多角色（EB）、FR-012 文字正規化、FR-013 情緒目錄、FR-015 批次、FR-016 字數計量、FR-017 NewebPay、FR-018 Clerk 登入、FR-019 BYOK、FR-020 企業 API、FR-021 Podcast 後製、FR-022 Shorts、FR-025 播放／分享、FR-026 RSS（EB）、FR-027 聲音複製（EB，不併入）、FR-029 Mock 測試模式（EB）、FR-030 法務頁 |
| 未實作 | FR-011 繁中發音校正詞庫、FR-024 自有內容聲明與產出存取控制 |

## 合併清單進度（SPEC §12.1；不搬項目見 SPEC §12.2，均未搬入，`test-book.epub` 未搬）

| # | 項目 | 里程碑 | 狀態 |
|---|---|---|---|
| 1 | parser + 測試 | M1 | ✅ M1 完成：`lib/audiobook/parser.ts`（函式本體與 EB 相同）＋ 27 個原測試 |
| 2 | TTS provider 介面、Orchestrator、Mock + 測試 | M1 | ✅ M1 完成：`lib/tts/provider.ts`（介面、Orchestrator、Mock）；EB 的 Google／Azure stub 未搬，改包裝 `lib/tts-engines.js` |
| 3 | audio（章節標記、命名、ID3）+ 測試 | M1 | ✅ M1 完成：`lib/audiobook/audio.ts`＋ 13 個原測試（`Character` 改為 `Speaker`） |
| 4 | subtitles（合成時序字幕）+ 測試 | M1 | ✅ M1 完成：`lib/audiobook/subtitles.ts`＋ 9 個原測試；與 `post-process.js`（Whisper 用）並存 |
| 5 | 字數額度規則 | M1 | ✅ M1 完成：規則改寫至 `lib/billing/usage.ts`（KV），未搬 Supabase |
| 6 | 整合測試寫法 | M1 | ✅ M1 完成：改寫為 `tests/integration/audiobook.integration.test.ts`；EB `api-routes.test.ts` 測的是不搬的 RSS／preview 路由，未移植 |
| 7 | 有聲書轉換流程（Mock） | M1 | ✅ M1 完成（Mock）：`lib/audiobook/pipeline.ts`、`/api/audiobook`；修正重複合成；正式引擎屬 M2 |
| 8 | characters（多角色） | M2 | 未開始（M2，本次不做） |
| 9 | 播放／分享頁 | M2 | 未開始（M2，本次不做） |
| 10 | RSS | M3 | 未開始（M3，本次不做） |
| 11 | 權利聲明文案 | M1 | ✅ M1 完成：`lib/rights.ts` 權利聲明（文案待法律覆核） |

## 發現的風險（本次盤點）

- 未在四個 repo 的追蹤檔案與 git 歷史中發現 API key、token 等憑證樣式字串（以常見金鑰樣式掃描；`.env.example` 只有占位值）。
- `ebook-to-audiobook/test-book.epub`：疑似受著作權保護的商業出版電子書，不得搬入；是否自該 repo 移除待 Sean 決定。
- 主 repo 分享功能把前 500 字原文放進 URL；`/api/v1/jobs/[id]` 與 `/download` 允許匿名在建立後 24 小時／30 天內讀取；`/api/v1/keys` 匿名可建立任意 tier；`/api/webhook/newebpay` log 整筆解密交易；引擎金鑰明文存 KV。
- `ebook-to-audiobook` 音檔存公開 bucket、ElevenLabs 金鑰明文存資料庫、每片段重複合成。
- README／舊 PRD 與程式不符處見 SPEC §13（含 tts-mvp、ebook-audio PRD 標示「已上線」但無程式）。

## 待 Sean 定案／覆審

1. 計費字數規則（標點是否計入、計費月份時區）與方案額度數值、價格（NT$ 三層或 USD 兩層）。
2. 權利聲明文案（`lib/rights.ts`）的法律覆核；產出保留期間（目前 24 小時）。
3. ~~合併清單逐項覆審~~ ✅ Sean 已於 2026-11-16 確認「合併清單覆審通過」。
4. `GOAL.md`／`SOP.md` 的機密掃描指令改為等價寫法（`sk_l[i]ve_`、`eyJhbGc[i]Oi`），避免指令文字比對到自己；比對結果與原樣式相同。
5. 合併本 PR 後 `deploy.yml` 會恢復運作並嘗試正式部署——何時合併由 Sean 決定。
6. PR #1（`chore/prd-rebuild`）尚未合併，本分支包含其文件 commit。
7. demo mode（未設定 Clerk）下所有訪客共用 `demo-user-001` 與其額度；正式上線前必須設定 Clerk。

## 下一步（M2，不在本次範圍）

私有物件儲存與背景佇列、正式引擎整本轉換、多角色配音、播放頁、NewebPay 沙箱端到端、詞庫管理 UI、BYOK 加密、SSRF 防護。
