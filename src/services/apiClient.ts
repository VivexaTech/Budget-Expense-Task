import { auth } from './firebase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://company-budget-api.vercel.app';

export async function callBackendApi<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: any
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || `Request failed with status ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error(`[ApiClient] Error calling ${endpoint}:`, err);
    return {
      success: false,
      error: err.message || 'Network error occurred while connecting to backend.',
    };
  }
}
