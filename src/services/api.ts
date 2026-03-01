import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
})

let onUnauthorized: (() => void) | null = null

/** Pozovi iz AuthProvider-a da se na 401 izloguje korisnik. Za cleanup prosledi null. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

// interceptor: add token in every request; za FormData ne postavljaj Content-Type (browser doda boundary)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
}, (error) => Promise.reject(error))

// na 401 (npr. istekao token) odjavi korisnika
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized()
    }
    return Promise.reject(error)
  }
)

export default api