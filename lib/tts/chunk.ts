/**
 * 長文字分段（FR-003）。原本在 /api/tts 與 /api/batch 各有一份相同實作，移到這裡共用。
 * 以段落為單位累積到 `size` 字；單一段落超過上限時再依句末標點切分。
 */

export const CHUNK_SIZE = 5000

export function chunkText(text: string, size: number = CHUNK_SIZE): string[] {
  const paragraphs = text.split(/\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length <= size) {
      current += (current ? '\n' : '') + para
    } else {
      if (current) chunks.push(current)
      if (para.length > size) {
        const sentences = para.split(/(?<=[。！？.!?])\s*/)
        current = ''
        for (const sent of sentences) {
          if (current && (current + sent).length > size) {
            chunks.push(current)
            current = sent
          } else {
            current += (current ? ' ' : '') + sent
          }
        }
      } else {
        current = para
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}
