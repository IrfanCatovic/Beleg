const INGEST_PATH = '/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb'
const SESSION_ID = '0e051d'

function debugIngestUrl(): string {
  try {
    const api = process.env.EXPO_PUBLIC_API_URL ?? ''
    const host = new URL(api).hostname
    return `http://${host}:7774${INGEST_PATH}`
  } catch {
    return `http://127.0.0.1:7774${INGEST_PATH}`
  }
}

export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix',
): void {
  const payload = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  console.log('[DEBUG-0e051d]', JSON.stringify(payload))
  fetch(debugIngestUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify(payload),
  }).catch(() => {
    fetch(`http://127.0.0.1:7774${INGEST_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
      body: JSON.stringify(payload),
    }).catch(() => {})
  })
  // #endregion
}

export function serializeUploadError(err: unknown): Record<string, unknown> {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string
      code?: string
      name?: string
      response?: { status?: number; data?: { error?: string } }
    }
    return {
      name: e.name,
      message: e.message,
      code: e.code,
      status: e.response?.status,
      serverError: e.response?.data?.error,
    }
  }
  return { raw: String(err) }
}
