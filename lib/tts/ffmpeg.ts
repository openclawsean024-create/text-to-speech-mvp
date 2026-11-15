/**
 * 以系統 ffmpeg 合併／轉檔編碼音訊（僅正式引擎路徑使用；Mock 模式不經過這裡）。
 * 原本內嵌在 /api/tts 與 /api/batch。每次呼叫使用獨立暫存目錄，避免並行請求互相覆寫。
 * 注意：Vercel 執行環境是否有 ffmpeg 尚未驗證（SOP 已知 blocker，M2 前需確認）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'))
  try {
    return fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function mergeMp3Chunks(chunks: Uint8Array[]): Buffer {
  return withTempDir((dir) => {
    const files = chunks.map((chunk, i) => {
      const file = path.join(dir, `chunk_${i}.mp3`)
      fs.writeFileSync(file, chunk)
      return file
    })
    const listFile = path.join(dir, 'chunks.txt')
    fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'))
    const outputFile = path.join(dir, 'merged.mp3')
    execFileSync('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputFile, '-y'], { stdio: 'ignore' })
    return fs.readFileSync(outputFile)
  })
}

export function mp3ToWav(mp3: Uint8Array): Buffer {
  return withTempDir((dir) => {
    const inputFile = path.join(dir, 'input.mp3')
    const outputFile = path.join(dir, 'output.wav')
    fs.writeFileSync(inputFile, mp3)
    execFileSync('ffmpeg', ['-i', inputFile, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', outputFile, '-y'], { stdio: 'ignore' })
    return fs.readFileSync(outputFile)
  })
}
