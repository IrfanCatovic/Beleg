import axios from 'axios'

const api = axios.create({
  // Sve ide preko istog origin-a (/api...). U dev-u Vite proxy prosleđuje backendu,
  // a u produkciji Vercel proxy function prosleđuje backendu. Tako auth cookie ostaje first-party.
  baseURL: '',
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

// Auth se oslanja iskljucivo na HttpOnly Secure cookie koji backend postavlja na /api/login.
// Frontend ne cuva i ne prosledjuje JWT token, sto smanjuje XSS rizik.
api.interceptors.request.use((config) => {
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
    const isLoginPost = method === 'post' && (reqUrl === '/api/login' || reqUrl.endsWith('/api/login'))
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
