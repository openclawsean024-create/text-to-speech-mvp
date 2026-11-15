/**
 * TTS 測試模式（GOAL AC-003 / FR-029）。
 *
 * `TTS_PROVIDER=mock` 或 `NODE_ENV=test` 時，所有合成路徑（/api/tts、/api/batch、
 * /api/preview、有聲書流程）只使用 MockTtsProvider，不會呼叫任何付費 TTS API。
 */
export function isMockTtsMode(): boolean {
  return (process.env.TTS_PROVIDER || '').toLowerCase() === 'mock' || process.env.NODE_ENV === 'test'
}
