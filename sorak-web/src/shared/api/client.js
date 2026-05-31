import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import { toast } from 'sonner';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true, // send httpOnly cookies automatically
  timeout: 30_000,
});

// No request interceptor needed — browser sends cookies automatically

let refreshingPromise = null;

const NO_REFRESH = ['/auth/login', '/auth/parent-login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const original = err.config;
    const url = original?.url ?? '';
    const isAuthEndpoint = NO_REFRESH.some((p) => url.includes(p));

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        refreshingPromise ??= axios
          .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
          .finally(() => { refreshingPromise = null; });
        await refreshingPromise;
        // New accessToken cookie set by server — just retry original
        return apiClient.request(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    if (status === 403) {
      toast.error('Bạn không có quyền thực hiện thao tác này');
    } else if (status && status >= 500) {
      toast.error('Lỗi máy chủ. Vui lòng thử lại sau.');
    } else {
      const data = err.response?.data;
      if (data?.message) toast.error(data.message);
    }

    return Promise.reject(err);
  },
);
