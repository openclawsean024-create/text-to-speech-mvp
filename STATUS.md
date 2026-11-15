# Status — 繁中 TTS 與有聲書工作台（text-to-speech-mvp）

- State：🟡 **PRD 重建完成／M1 尚未開發**（2026-11-16）
- 本次性質：文件重建（`PRD/SPEC.md`、`GOAL.md`、`AGENTS.md`、`SOP.md`、`STATUS.md`），未修改任何功能程式碼、設定或測試。
- 基準 commit：`master` @ `96b2eac`；文件分支 `chore/prd-rebuild`（Draft PR）。

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

## 合併清單進度（SPEC §12.1）

| # | 項目 | 里程碑 | 狀態 |
|---|---|---|---|
| 1 | parser + 測試 | M1 | 未開始 |
| 2 | TTS provider 介面、Orchestrator、Mock + 測試 | M1 | 未開始 |
| 3 | audio（章節標記、命名、ID3）+ 測試 | M1 | 未開始 |
| 4 | subtitles（合成時序字幕）+ 測試 | M1 | 未開始 |
| 5 | 字數額度規則 | M1 | 未開始 |
| 6 | 整合測試寫法 | M1 | 未開始 |
| 7 | 有聲書轉換流程（Mock） | M1 | 未開始 |
| 8 | characters（多角色） | M2 | 未開始 |
| 9 | 播放／分享頁 | M2 | 未開始 |
| 10 | RSS | M3 | 未開始 |
| 11 | 權利聲明文案 | M1 | 未開始 |

## 發現的風險（本次盤點）

- 未在四個 repo 的追蹤檔案與 git 歷史中發現 API key、token 等憑證樣式字串（以常見金鑰樣式掃描；`.env.example` 只有占位值）。
- `ebook-to-audiobook/test-book.epub`：疑似受著作權保護的商業出版電子書，不得搬入；是否自該 repo 移除待 Sean 決定。
- 主 repo 分享功能把前 500 字原文放進 URL；`/api/v1/jobs/[id]` 與 `/download` 允許匿名在建立後 24 小時／30 天內讀取；`/api/v1/keys` 匿名可建立任意 tier；`/api/webhook/newebpay` log 整筆解密交易；引擎金鑰明文存 KV。
- `ebook-to-audiobook` 音檔存公開 bucket、ElevenLabs 金鑰明文存資料庫、每片段重複合成。
- README／舊 PRD 與程式不符處見 SPEC §13（含 tts-mvp、ebook-audio PRD 標示「已上線」但無程式）。

## 下一步

1. Sean 覆審本 PR 與 SPEC §14 待確認事項（方案與單價、計費字數定義、被併入 repo 的處置、聲音複製、保留期間）。
2. 核可後依 `SOP.md` 的 M1 工作順序開發；每完成一個 AC 更新本檔與合併清單。
