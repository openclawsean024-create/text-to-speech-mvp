/**
 * 使用者自有內容聲明（FR-024；GOAL AC-007）。
 *
 * 上傳電子書前必須明確同意此聲明（請求帶 `rightsConfirmed: true`），聲明版本與時間戳記
 * 隨工作保存。文案為 M1 草稿，【待法律覆核】（SPEC §14-7）；修改文案時請同步更新版本號。
 */

export const RIGHTS_STATEMENT_VERSION = '2026-11-16'

export const RIGHTS_STATEMENT =
  '我確認上傳的內容是我本人創作、擁有著作權，或已取得著作權人授權可轉換為語音。' +
  '本服務僅限處理自有或已授權內容，不提供 DRM 移除；產出的音檔與字幕僅供我本人使用，' +
  '未經授權不得公開散布。若違反上述聲明，相關責任由上傳者自行承擔。'

export const RIGHTS_SHORT_NOTICE = '僅限上傳您擁有或已取得授權的內容。'

export interface RightsRecord {
  confirmed: true
  /** ISO 8601 時間戳記（伺服器時間）。 */
  confirmedAt: string
  statementVersion: string
}

/** 只有布林 true 或字串 "true" 視為已聲明；其餘（含 "1"、"yes"、缺少）一律視為未聲明。 */
export function isRightsConfirmed(value: unknown): boolean {
  return value === true || value === 'true'
}

export function makeRightsRecord(now: Date = new Date()): RightsRecord {
  return { confirmed: true, confirmedAt: now.toISOString(), statementVersion: RIGHTS_STATEMENT_VERSION }
}
