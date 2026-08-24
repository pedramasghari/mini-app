let refreshPromise: Promise<boolean> | null = null;

async function refreshTelegramSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const telegram = window.Telegram?.WebApp;
      const initData = telegram?.initData;

      if (!initData) return false;

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ initData }),
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options?: RequestInit, canRetry = true): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: 'include',
    ...options,
  });

  const text = await response.text();

  if (response.ok) {
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  let message = text || 'خطا در درخواست';
  try {
    const data = JSON.parse(text);
    message = Array.isArray(data.message)
      ? data.message.join('، ')
      : data.message || message;
  } catch {
    // پاسخ غیر JSON را با همان متن خطا ادامه می‌دهیم.
  }

  const isUnauthorized = response.status === 401;
  const isAuthEndpoint = path === 'auth/telegram' || path === 'auth/me';

  if (isUnauthorized && canRetry && !isAuthEndpoint) {
    const refreshed = await refreshTelegramSession();

    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  throw new Error(message);
}

export function api<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options);
}

export const fa = (value: number | string) =>
  Number(value || 0).toLocaleString('fa-IR');
