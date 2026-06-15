import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// Attach auth token on every request (client-side)
apiClient.interceptors.request.use(async (config) => {
  // On the server we skip token injection (SSR uses cookies via next-auth)
  if (typeof window === 'undefined') return config;

  try {
    const { getSession } = await import('next-auth/react');
    const session = await getSession();
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // No session — unauthenticated request
  }
  return config;
});

// Global response error handler
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
