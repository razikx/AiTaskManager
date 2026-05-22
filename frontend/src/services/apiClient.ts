import axios from 'axios';
import { supabase } from './supabaseClient';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject JWT Bearer Token to all outgoing requests
apiClient.interceptors.request.use(
  async (config) => {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session?.access_token) {
      config.headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Standard API Request helper interface from AGENT.md for type safety
export async function handleApiRequest<T>(requestPromise: Promise<T>): Promise<[T | null, Error | null]> {
  try {
    const data = await requestPromise;
    return [data, null];
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const errorObj = error.response?.data?.error;
      const errorMessage =
        typeof errorObj === 'object' && errorObj !== null && 'message' in errorObj
          ? (errorObj as { message: string }).message
          : typeof errorObj === 'string'
          ? errorObj
          : error.message;
      return [null, new Error(errorMessage)];
    }
    return [null, error as Error];
  }
}
