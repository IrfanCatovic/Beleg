import axios from 'axios'

// U dev-u koristi prazan baseURL da request ide na isti origin (Vite proxy prosleđuje na backend).
// U produkciji: ako su frontend i backend na istom domenu, ostavi ''. Inače postavi VITE_API_URL.
const apiBaseURL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let onUnauthorized: (() => void) | null = null

/** Pozovi iz AuthProvider-a da se na 401 izloguje korisnik. Za cleanup prosledi null. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

// Fallback za produkciju kada frontend i backend nisu na istom site-u pa browser ne prihvati cookie.
// Primarni mehanizam ostaje HttpOnly cookie, ali Bearer zadržava postojeće cross-origin deploy-eve funkcionalnim.
const AUTH_TOKEN_KEY = 'auth_token'

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
  else localStorage.removeItem(AUTH_TOKEN_KEY)
}

api.interceptors.request.use((config) => {
  const bearer = localStorage.getItem(AUTH_TOKEN_KEY)
  if (bearer) {
    config.headers.Authorization = `Bearer ${bearer}`
  }
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser) as { role?: string }
      const clubId = localStorage.getItem('superadmin_club_id')
      if (user.role === 'superadmin' && clubId) {
        config.headers['X-Club-Id'] = clubId
      }
    } catch {
      // ignore parse error
    }
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
}, (error) => Promise.reject(error))

// na 401 (npr. istekao token) ili 403 (klub na hold-u) odjavi korisnika
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const reqUrl = (error.config?.url || '').toString()
    const method = (error.config?.method || '').toLowerCase()
    const isLoginPost = method === 'post' && (reqUrl === '/login' || reqUrl.endsWith('/login'))
    if (error.response?.status === 401 && onUnauthorized && !isLoginPost) {
      onUnauthorized()
    } else if (error.response?.status === 403 && onUnauthorized) {
      const msg = (error.response?.data as { error?: string })?.error ?? ''
      if (msg.includes('hold') || msg.includes('suspendovan')) {
        onUnauthorized()
      }
    }
    return Promise.reject(error)
  }
)

export default api
