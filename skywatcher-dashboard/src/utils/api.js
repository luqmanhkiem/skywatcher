import axios from 'axios'

const TOKEN_KEY = 'sw_token'

const api = axios.create({ baseURL: '/api' })

// Attach JWT to every request automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token and redirect to login
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      // Only redirect if not already on /login to avoid loops
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Staff / Admin endpoints ──────────────────────────────────
export const fetchBags       = ()       => api.get('/bags').then(r => r.data)
export const fetchBagHistory = (tagId)  => api.get(`/bags/${tagId}/history`).then(r => r.data)
export const fetchAlerts     = (limit = 50) => api.get(`/alerts?limit=${limit}`).then(r => r.data)
export const fetchStats      = ()       => api.get('/stats').then(r => r.data)
export const fetchFlights    = ()       => api.get('/flights').then(r => r.data)
export const resolveAlert    = (id)     => api.patch(`/alerts/${id}/resolve`).then(r => r.data)

// ── Auth endpoints ───────────────────────────────────────────
export const login  = (username, password) => api.post('/auth/login', { username, password }).then(r => r.data)
export const logout = ()                   => api.post('/auth/logout').then(r => r.data)
export const getMe  = ()                   => api.get('/auth/me').then(r => r.data)

// ── Admin user management ────────────────────────────────────
export const fetchUsers     = ()         => api.get('/admin/users').then(r => r.data)
export const createUser     = (data)     => api.post('/admin/users', data).then(r => r.data)
export const updateUser     = (id, data) => api.patch(`/admin/users/${id}`, data).then(r => r.data)
export const deactivateUser = (id)       => api.patch(`/admin/users/${id}/deactivate`).then(r => r.data)
export const injectBag      = (data)     => api.post('/admin/simulate', data).then(r => r.data)

// ── Analytics endpoints ──────────────────────────────────────
export const fetchAnomalyTrend      = () => api.get('/stats/anomaly-trend').then(r => r.data)
export const fetchFlightAnomalies   = () => api.get('/stats/flight-anomalies').then(r => r.data)
export const fetchAvgResolution     = () => api.get('/stats/avg-resolution').then(r => r.data)
export const fetchCheckpointHeatmap = () => api.get('/stats/checkpoint-heatmap').then(r => r.data)

// ── Public passenger tracking (no auth) ──────────────────────
export const trackBag = (flightId, passenger) =>
  api.get(`/track?flight_id=${encodeURIComponent(flightId)}&passenger=${encodeURIComponent(passenger)}`).then(r => r.data)

export default api
