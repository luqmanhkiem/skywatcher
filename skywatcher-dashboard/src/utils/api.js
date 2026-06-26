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
export const fetchBagStatusHistory = (tagId) => api.get(`/bags/${tagId}/status-history`).then(r => r.data)
export const registerScan    = (tagId, payload) => api.post(`/bags/${tagId}/scan`, payload).then(r => r.data)
export const bagAction       = (tagId, action)  => api.post(`/bags/${tagId}/action`, { action }).then(r => r.data)
export const fetchAlerts     = (limit = 50) => api.get(`/alerts?limit=${limit}`).then(r => r.data)
export const fetchStats      = ()       => api.get('/stats').then(r => r.data)
export const fetchFlights      = ()                    => api.get('/flights').then(r => r.data)
export const setFlightCarousel = (flightId, carousel) => api.put(`/flights/${encodeURIComponent(flightId)}/carousel`, { carousel }).then(r => r.data)
export const resolveAlert    = (id)     => api.patch(`/alerts/${id}/resolve`).then(r => r.data)

// ── Auth endpoints ───────────────────────────────────────────
export const login  = (username, password) => api.post('/auth/login', { username, password }).then(r => r.data)
export const logout = ()                   => api.post('/auth/logout').then(r => r.data)
export const getMe          = ()                   => api.get("/auth/me").then(r => r.data)
export const forgotPassword = (email)              => api.post("/auth/forgot-password", { email }).then(r => r.data)
export const resetPassword  = (token, password)    => api.post("/auth/reset-password", { token, password }).then(r => r.data)

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
export const trackByBookingRef = (bookingRef) =>
  api.get(`/track?booking_ref=${encodeURIComponent(bookingRef)}`).then(r => r.data)
export const trackBag = (flightId, passenger) =>
  api.get(`/track?flight_id=${encodeURIComponent(flightId)}&passenger=${encodeURIComponent(passenger)}`).then(r => r.data)
export const subscribeArrival = (tagId, email) =>
  api.post('/track/notify', { tag_id: tagId, email }).then(r => r.data)               // public
export const genBookingRef = () =>
  api.get('/admin/booking-ref').then(r => r.data.booking_ref)

// ── Checkpoint advisories ────────────────────────────────────
export const fetchAdvisories        = (all = false) =>
  api.get(`/advisories${all ? '?all=true' : ''}`).then(r => r.data)
export const setAdvisory            = (checkpoint, data) =>
  api.put(`/advisories/${checkpoint}`, data).then(r => r.data)
export const requestAdvisory        = (data) =>
  api.post('/advisories/request', data).then(r => r.data)
export const fetchAdvisoryRequests  = (status) =>
  api.get(`/advisories/requests${status ? `?status=${status}` : ''}`).then(r => r.data)
export const approveAdvisoryRequest = (id) =>
  api.put(`/advisories/requests/${id}/approve`).then(r => r.data)
export const rejectAdvisoryRequest  = (id) =>
  api.put(`/advisories/requests/${id}/reject`).then(r => r.data)

// ── Customer feedback ────────────────────────────────────────
export const submitFeedback = (data)         => api.post('/feedback', data).then(r => r.data)        // public
export const fetchFeedback  = (limit = 100)  => api.get(`/feedback?limit=${limit}`).then(r => r.data) // staff/admin
export const updateFeedback = (id, data)     => api.patch(`/feedback/${id}`, data).then(r => r.data)  // staff/admin

export default api
