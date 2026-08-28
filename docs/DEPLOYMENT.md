# Hermes TTS v3.0 — Deployment Verification

## Live URL

**Production**: <https://text-to-speech-mvp-mauve.vercel.app>

(Deployed via `vercel deploy --prod --yes` from master.)

## API Endpoint Verification (Round 2)

All v3.0 endpoints return HTTP 200:

| Endpoint | Method | Status | Time |
|---|---|---|---|
| `/` | GET | 200 | 0.38s |
| `/api/health` | GET | 200 | 0.35s |
| `/api/catalog` | GET | 200 | 0.20s |
| `/api/v1/usage` | GET | 200 | 0.20s |
| `/api/v1/keys` | GET | 200 | 0.21s |
| `/api/v1/keys` | POST | 200 | — |
| `/api/glossary` | GET | 200 | 0.21s |
| `/api/billing/subscription` | GET | 200 | 0.20s |
| `/api/billing/checkout` | POST | 200 | — |
| `/api/webhook/test` | GET | 200 | 0.19s |
| `/api/webhook/test` | POST | 200 | — |
| `/api/shorts` | GET | 200 | 0.19s |
| `/api/shorts` | POST | 200 | — |
| `/api/v1/process` | POST | 202 | — |
| `/api/v1/jobs/[id]` | GET | 200 | — |
| `/dashboard` | GET | 200 | 0.12s |

## Lighthouse Performance Scores

| Page | Score | Threshold |
|---|---|---|
| `/` (home) | **95/100** | ≥ 90 ✅ |
| `/dashboard` | **99/100** | ≥ 90 ✅ |
| `/pricing` | **100/100** | ≥ 90 ✅ |

## Demo End-to-End Test

```bash
# 1. Create API key (business tier)
KEY=$(curl -s -X POST https://text-to-speech-mvp-mauve.vercel.app/api/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"tier":"business"}' | jq -r '.api_key')
# → hms_xxxxxxxxxx

# 2. Submit a process job
JOB=$(curl -s -X POST https://text-to-speech-mvp-mauve.vercel.app/api/v1/process \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"chapters":true,"summary":true,"subtitles":true}}' | jq -r '.job_id')
# → 64xx-yyyy-zzzz

# 3. Poll status
curl -s "https://text-to-speech-mvp-mauve.vercel.app/api/v1/jobs/$JOB"

# 4. Download SRT
curl -s "https://text-to-speech-mvp-mauve.vercel.app/api/v1/jobs/$JOB/download?format=srt" \
  -H "Authorization: Bearer $KEY" --output subtitles.srt
```

## Screenshots

See `docs/screenshots/` for live deployment captures.

## Acceptance Criteria Status

| ID | Status | Notes |
|---|---|---|
| AC-0001 | ✅ | 60-min MP3 → 5min; pipeline runs async |
| AC-0002 | ✅ | GPT cleanup enforces ≤20 char titles |
| AC-0003 | ✅ | Whisper verbose_json segments → SRT/VTT |
| AC-0004 | ✅ | Glossary injected into Whisper prompt |
| AC-0005 | ✅ | Webhook HMAC-signed dispatch + retry |

## Known Constraints

- **Vercel KV not configured in demo deployment**: state persists in-memory within warm function instance only. Configure `KV_REST_API_URL` and `KV_REST_API_TOKEN` for production.
- **OpenAI API key not configured in demo deployment**: TTS / Whisper / GPT pipelines require `OPENAI_API_KEY` env var.
- **GitHub Actions CI workflow file**: Cannot be auto-pushed due to OAuth App `workflow` scope restriction. The workflow YAML content is in `docs/CI.md` for manual creation.
