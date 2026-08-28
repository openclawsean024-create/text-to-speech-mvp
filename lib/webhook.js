/**
 * Webhook dispatcher — F-007 (per SPEC §4.4 enterprise webhook)
 *
 * HMAC-SHA256 signed POST callback with retry + backoff.
 */

const crypto = require('node:crypto')

function getSecret() {
  return process.env.WEBHOOK_SECRET || 'change-me-to-random-32-bytes'
}

/**
 * Sign a payload using HMAC-SHA256.
 * Header: X-Signature: sha256=<hex>
 */
function signPayload(payloadJson, secret = getSecret()) {
  const hmac = crypto.createHmac('sha256', secret).update(payloadJson).digest('hex')
  return `sha256=${hmac}`
}

/**
 * Verify a webhook signature (used by webhook receivers for testing).
 */
function verifyPayload(payloadJson, signatureHeader, secret = getSecret()) {
  const expected = signPayload(payloadJson, secret)
  // Constant-time comparison
  if (expected.length !== signatureHeader.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

/**
 * Dispatch a webhook with retry.
 * @param {string} url
 * @param {object} payload
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=3]
 * @returns {Promise<{ delivered: boolean, attempts: number, lastError?: string }>}
 */
async function dispatch(url, payload, opts = {}) {
  const { maxRetries = 3, timeoutMs = 10_000 } = opts
  if (!url || !/^https?:\/\//.test(url)) {
    return { delivered: false, attempts: 0, lastError: 'Invalid webhook URL' }
  }
  const body = JSON.stringify(payload)
  const signature = signPayload(body)
  let attempt = 0
  let lastError = 'unknown'
  while (attempt < maxRetries) {
    attempt++
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Webhook-Source': 'hermes-tts',
          'X-Attempt': String(attempt),
        },
        body,
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (resp.ok) {
        return { delivered: true, attempts: attempt }
      }
      lastError = `HTTP ${resp.status}`
    } catch (err) {
      lastError = err.message || String(err)
    }
    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  return { delivered: false, attempts: attempt, lastError }
}

module.exports = {
  signPayload,
  verifyPayload,
  dispatch,
}
