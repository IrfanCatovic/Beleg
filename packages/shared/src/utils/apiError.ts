type ApiErrorShape = {
  response?: {
    data?: {
      error?: string
    }
  }
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const apiErr = err as ApiErrorShape
    const serverMessage = apiErr.response?.data?.error
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage
    }
  }
  return fallback
}
