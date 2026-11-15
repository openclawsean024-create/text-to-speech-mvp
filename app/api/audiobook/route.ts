import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { authorizeOwner } from '@/lib/access-control'
import { isRightsConfirmed, RIGHTS_STATEMENT, RIGHTS_STATEMENT_VERSION } from '@/lib/rights'
import { isMockTtsMode } from '@/lib/tts/mode'
import { BookFileError, parseBookFile } from '@/lib/audiobook/extract'
import { MAX_FILE_BYTES } from '@/lib/audiobook/types'
import { summarizeJob } from '@/lib/audiobook/jobs'
import { AudiobookRequestError, mockMaxChars, startAudiobookConversion } from '@/lib/audiobook/service'
import { identityUserId } from '@/lib/identity'
import { lexiconTransformer } from '@/lib/lexicon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface UploadFields {
  buffer: Buffer | null
  filename: string
  rightsConfirmed: unknown
  title?: string
  engine?: string
  voice?: string
  speed?: number
  declaredSize: number
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function readUpload(req: NextRequest): Promise<UploadFields> {
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    const isFile = typeof file === 'object' && file !== null && 'arrayBuffer' in file
    const size = isFile ? (file as File).size : 0
    return {
      // 超過上限的檔案不讀進記憶體
      buffer: isFile && size <= MAX_FILE_BYTES ? Buffer.from(await (file as File).arrayBuffer()) : null,
      declaredSize: size,
      filename: isFile ? (file as File).name || 'upload.txt' : '',
      rightsConfirmed: form.get('rightsConfirmed'),
      title: str(form.get('title')),
      engine: str(form.get('engine')),
      voice: str(form.get('voice')),
      speed: form.has('speed') ? Number(form.get('speed')) : undefined,
    }
  }

  // JSON：{ rightsConfirmed: true, filename, text | contentBase64, title?, voice?, speed?, engine? }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  let buffer: Buffer | null = null
  if (typeof body.contentBase64 === 'string') buffer = Buffer.from(body.contentBase64, 'base64')
  else if (typeof body.text === 'string') buffer = Buffer.from(body.text, 'utf8')
  return {
    buffer,
    declaredSize: buffer?.length ?? 0,
    filename: str(body.filename) ?? (typeof body.text === 'string' ? 'upload.txt' : ''),
    rightsConfirmed: body.rightsConfirmed,
    title: str(body.title),
    engine: str(body.engine),
    voice: str(body.voice),
    speed: body.speed === undefined ? undefined : Number(body.speed),
  }
}

/**
 * 建立有聲書轉換工作（FR-007、FR-024；GOAL AC-004、AC-007）。
 *
 * - 必須登入（或 demo mode／API key），且請求帶 `rightsConfirmed: true`，否則 400。
 * - 解析走 lib/audiobook/extract.ts：50MB 上限、簽章檢查、【不截斷字數】。
 * - M1 只在測試模式（Mock）執行；每個片段只合成一次；按字數計量。
 */
export async function POST(req: NextRequest) {
  const identity = await resolveIdentity(req, { allowApiKey: true })
  const denied = authorizeOwner(identity, {})
  if (identity.kind === 'anonymous' && denied.allowed === false) {
    return NextResponse.json({ error: denied.error, code: denied.code }, { status: denied.status })
  }

  let upload: UploadFields
  try {
    upload = await readUpload(req)
  } catch {
    return NextResponse.json({ error: '無法讀取上傳內容。', code: 'BAD_REQUEST' }, { status: 400 })
  }

  // ── 使用者自有內容聲明（未聲明一律 400）──────────────────────
  if (!isRightsConfirmed(upload.rightsConfirmed)) {
    return NextResponse.json(
      {
        error: '請先確認「僅限自有內容」聲明（rightsConfirmed: true）後再上傳。',
        code: 'RIGHTS_NOT_CONFIRMED',
        rights: { version: RIGHTS_STATEMENT_VERSION, statement: RIGHTS_STATEMENT },
      },
      { status: 400 },
    )
  }

  if (upload.declaredSize > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds 50MB limit. Please compress first.', code: 'FILE_TOO_LARGE' },
      { status: 413 },
    )
  }
  if (!upload.buffer || !upload.filename) {
    return NextResponse.json({ error: '請提供要轉換的檔案（file）。', code: 'NO_FILE' }, { status: 400 })
  }

  try {
    const book = await parseBookFile({ buffer: upload.buffer, filename: upload.filename, title: upload.title })
    const outcome = await startAudiobookConversion({
      identity,
      book,
      filename: upload.filename,
      engine: upload.engine,
      voice: upload.voice,
      speed: upload.speed,
      // 發音校正詞庫（AC-006）：只影響送進引擎的文字，字幕與計費用原文
      transformText: await lexiconTransformer(identityUserId(identity)),
    })
    const summary = summarizeJob(outcome.job)
    if (!outcome.ok) {
      return NextResponse.json({ ok: false, code: 'CONVERSION_FAILED', error: outcome.job.errorMsg, ...summary }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...summary }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof BookFileError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    }
    if (err instanceof AudiobookRequestError) {
      return NextResponse.json({ ...err.extra, error: err.message, code: err.code }, { status: err.status })
    }
    console.error('[audiobook] Error:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: '有聲書轉換失敗。', code: 'AUDIOBOOK_ERROR' }, { status: 500 })
  }
}

/** 上傳前的資訊：權利聲明文案與限制（不需登入）。 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    rights: { version: RIGHTS_STATEMENT_VERSION, statement: RIGHTS_STATEMENT },
    limits: { max_file_bytes: MAX_FILE_BYTES, max_chars_mock_mode: mockMaxChars() },
    supported_types: ['txt', 'epub', 'pdf'],
    mode: isMockTtsMode() ? 'mock' : 'unavailable',
    note: 'M1：有聲書轉換僅在測試模式（Mock TTS）開放；正式引擎的整本轉換屬 M2。',
  })
}
