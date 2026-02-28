import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
})

//interceptor: add token in every request; za FormData ne postavljaj Content-Type (browser doda boundary)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}` 
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default api