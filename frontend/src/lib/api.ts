import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5204';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart_toeic_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('smart_toeic_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function extractErrorMessage(err: unknown, fallback = 'Đã xảy ra lỗi, vui lòng thử lại.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; title?: string; errors?: Record<string, string[]> } | undefined;
    if (data?.message) return data.message;
    if (data?.errors) {
      const firstErr = Object.values(data.errors).flat()[0];
      if (firstErr) return firstErr;
    }
    if (data?.title) return data.title;
  }
  return fallback;
}
