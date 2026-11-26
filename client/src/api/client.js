import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let isRefreshing = false;
let pendingQueue = [];

function processQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('schll_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh')
    ) {
      const refreshToken = localStorage.getItem('schll_refresh_token');
      if (!refreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((newToken) => {
          if (!original.headers) original.headers = {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { withCredentials: true });
        const { accessToken, refreshToken: newRefresh } = res.data.data;
        localStorage.setItem('schll_access_token', accessToken);
        if (newRefresh) localStorage.setItem('schll_refresh_token', newRefresh);
        processQueue(null, accessToken);
        if (!original.headers) original.headers = {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('schll_access_token');
        localStorage.removeItem('schll_refresh_token');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err) {
  const errData = err?.response?.data?.error;
  if (errData) {
    if (Array.isArray(errData.details) && errData.details.length > 0) {
      return errData.details
        .map((d) => (d.message ? (d.path ? `${d.path}: ${d.message}` : d.message) : String(d)))
        .join(', ');
    }
    return errData.message || 'Something went wrong';
  }
  return err?.message || 'Something went wrong';
}
