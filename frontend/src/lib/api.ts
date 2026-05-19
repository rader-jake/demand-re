import axios, { AxiosError } from 'axios';

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const sessionId = localStorage.getItem('session_id') || crypto.randomUUID();
    localStorage.setItem('session_id', sessionId);
    config.headers['x-session-id'] = sessionId;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken }, { withCredentials: true });
          localStorage.setItem('access_token', data.accessToken);
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${data.accessToken}`;
            return api.request(error.config);
          }
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; role: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  updateMe: (data: { firstName?: string; lastName?: string; phone?: string }) => api.put('/auth/me', data),
};

// Tenant
export const tenantApi = {
  getProfile: () => api.get('/tenants/profile'),
  createProfile: (data: Record<string, unknown>) => api.post('/tenants/profile', data),
  updateProfile: (data: Record<string, unknown>) => api.put('/tenants/profile', data),
  updateSpaceRequirements: (data: Record<string, unknown>) => api.put('/tenants/profile/space-requirements', data),
  updateStatus: (status: string) => api.put('/tenants/profile/status', { status }),
  getInterests: () => api.get('/tenants/interests'),
  respondToInterest: (id: string, status: 'accepted' | 'declined') =>
    api.put(`/tenants/interests/${id}/respond`, { status }),
};

// Landlord
export const landlordApi = {
  getProfile: () => api.get('/landlords/profile'),
  updateProfile: (data: Record<string, unknown>) => api.put('/landlords/profile', data),
  searchTenants: (filters: Record<string, unknown>) => api.get('/landlords/search', { params: filters }),
  getTenant: (profileId: string) => api.get(`/landlords/tenants/${profileId}`),
  expressInterest: (profileId: string, message?: string) =>
    api.post(`/landlords/interest/${profileId}`, { message }),
  saveTenant: (profileId: string, data?: { notes?: string; tags?: string[] }) =>
    api.post(`/landlords/save/${profileId}`, data ?? {}),
  unsaveTenant: (profileId: string) => api.delete(`/landlords/save/${profileId}`),
  getSaved: () => api.get('/landlords/saved'),
  getInterests: () => api.get('/landlords/interests'),
  getAlerts: () => api.get('/landlords/alerts'),
  createAlert: (data: Record<string, unknown>) => api.post('/landlords/alerts', data),
  deleteAlert: (id: string) => api.delete(`/landlords/alerts/${id}`),
  getDeals: () => api.get('/landlords/deals'),
  createDeal: (data: Record<string, unknown>) => api.post('/landlords/deals', data),
  updateDeal: (id: string, data: Record<string, unknown>) => api.put(`/landlords/deals/${id}`, data),
};

// Messages
export const messageApi = {
  getConversations: () => api.get('/messages/conversations'),
  getConversation: (id: string) => api.get(`/messages/conversations/${id}`),
  startConversation: (data: { recipientId: string; message: string; subject?: string }) =>
    api.post('/messages/conversations', data),
  sendMessage: (conversationId: string, content: string) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { content }),
};

// Billing
export const billingApi = {
  getStatus: () => api.get('/billing/status'),
  subscribe: () => api.post('/billing/subscribe'),
  portal: () => api.post('/billing/portal'),
  buyReport: () => api.post('/billing/buy-report'),
};

// Admin
export const adminApi = {
  getUsers: (params: Record<string, unknown>) => api.get('/admin/users', { params }),
  updateUserStatus: (id: string, isActive: boolean) => api.put(`/admin/users/${id}/status`, { isActive }),
  getOverview: () => api.get('/admin/analytics/overview'),
  getDemandHeatmap: (period?: number) => api.get('/admin/analytics/demand-heatmap', { params: { period } }),
  getTenantInsights: () => api.get('/admin/analytics/tenant-insights'),
  exportData: (type: string) => api.get('/admin/analytics/export', { params: { type } }),
};

// Analytics
export const analyticsApi = {
  getTrends: (metric: string, days?: number) => api.get('/analytics/trends', { params: { metric, days } }),
  getNeighborhoodDemand: (filters?: Record<string, unknown>) =>
    api.get('/analytics/neighborhood-demand', { params: filters }),
  getIndustryInsights: () => api.get('/analytics/industry-insights'),
};

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.message;
  }
  return 'An unexpected error occurred';
}
