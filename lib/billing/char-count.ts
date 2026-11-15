/**
 * 計費字數（GOAL AC-005；定義沿用 PRD/SPEC.md §14-2 的建議預設，【待 Sean 定案】）。
 *
 * 規則：
 *   1. 以「詞庫套用與正規化之前的原文」計算。
 *   2. 先做 Unicode NFC 正規化，讓組合字元（例：e + ◌́）與預組字元計為相同字數。
 *   3. 去除所有空白：半形／全形空白（U+3000）、Tab、換行、NBSP，以及零寬字元
 *      （U+200B、U+2060、U+FEFF）。
 *   4. 其餘每個 Unicode 碼位（code point）計 1 字：中日韓文字、英文字母、數字、
 *      半形與全形標點、符號、emoji 皆計入（標點是否計入為待定案項目，目前「計入」）。
 */

const NON_BILLABLE = /[\s​⁠﻿]/gu

export const CHAR_COUNT_RULE_VERSION = 'm1-default-2026-11'

export function countBillableChars(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0
  const stripped = text.normalize('NFC').replace(NON_BILLABLE, '')
  let count = 0
  // for...of 以碼位迭代，代理對（surrogate pair）計為 1
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of stripped) count++
  return count
}
