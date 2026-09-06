# E2E — text-to-speech-mvp

結構性 E2E 測試（structural smoke test），確認 production build 完整且關鍵模組可載入。

## 跑法

```bash
# 必須先 build 過（.next/ 必須存在）
pnpm run build
node --test e2e/smoke.test.mjs
```

## 涵蓋的檢查

1. **Build artifact** — `.next/` 存在且有 `build-manifest`
2. **Route segments** — 19 條 Next.js App Router 路由都有 build artifact
3. **PRD v3.0.2** — `PRD/SPEC.md` 標頭是 v3.0.2、有 §0.1 changelog
4. **CHANGELOG** — `PRD/CHANGELOG.md` 有 v3.0.2 條目
5. **GHA ci.yml** — 存在、跑 `pnpm run ci`、branch = master、有 `workflow_dispatch`
6. **GHA deploy.yml** — branch = master（不是 main）、用 `vercel-action@v25`
7. **vercel.json** — 合法、framework = nextjs
8. **Hermes engines** — 5 引擎 × 12 情緒 × 12 角色 × 12 預設
9. **post-process** — SRT / VTT 格式正確
10. **ePub builder** — 能產出有效 archive
11. **webhook** — sign/verify roundtrip 成功

## 為什麼用 `node:test` 而非 vitest

- 此 repo 用 pnpm 沒有裝 vitest / jest
- Node 20+ 內建 `node:test` 零成本
- 既有的 `scripts/ci-smoke.js` 是 unit-level，這個 E2E 是 post-build structural
