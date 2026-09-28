import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;
let pendingQueue: (() => void)[] = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const {
        refreshToken,
        user,
        setSession,
        clearSession,
      } = useAuthStore.getState();

      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push(() => resolve(api(original)));
        });
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
          { refreshToken },
        );

        setSession(
          data.data.accessToken,
          data.data.refreshToken,
          user!,
        );

        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        isRefreshing = false;

        return api(original);
      } catch (refreshError) {
        isRefreshing = false;
        clearSession();
        window.location.href = '/login';

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export function apiErrorMessage(err: any): string {
  if (!err?.response) {
    return 'Unable to connect to the MarineVision server';
  }

  if (err.response.status === 401) {
    return 'Invalid email or password';
  }

  if (err.response.status === 403) {
    return 'Your account is not authorized';
  }

  if (err.response.status === 404) {
    return 'Authentication service not found';
  }

  if (err.response.status === 500) {
    return 'Authentication service temporarily unavailable';
  }

  return (
    err.response?.data?.error?.message ||
    err?.message ||
    'An unexpected error occurred.'
  );
}

export function wsUrl(): string {
  const token = useAuthStore.getState().accessToken;

  const protocol =
    window.location.protocol === 'https:' ? 'wss' : 'ws';

  const host =
    import.meta.env.VITE_WS_HOST ||
    window.location.host;

  return `${protocol}://${host}/api/realtime?token=${token}`;
}
