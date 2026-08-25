type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
};

function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.initData || null;
}

async function authenticateTelegram(): Promise<boolean> {
  const initData = getTelegramInitData();
  if (!initData) return false;

  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  return response.ok;
}

function getErrorMessage(text: string): string {
  if (!text.trim()) return 'خطا در درخواست';

  try {
    const data = JSON.parse(text) as ApiErrorPayload;
    if (Array.isArray(data.message)) return data.message.join('، ');
    if (data.message) return data.message;
    if (data.error) return data.error;
  } catch {
    // Backend may return plain text or an HTML error page.
  }

  return text;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const request = () => fetch(`/api/${path}`, {
    credentials: 'include',
    ...options,
  });

  let response = await request();

  // `/panel` can be opened directly without visiting `/` first. Recover the
  // session from Telegram initData once, then retry the original request.
  if (response.status === 401 && path !== 'auth/telegram') {
    try {
      if (await authenticateTelegram()) response = await request();
    } catch {
      // Preserve the original authentication error below.
    }
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(getErrorMessage(text));
  }

  if (!text.trim()) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('پاسخ نامعتبر از سرور دریافت شد.');
  }
}

export const fa = (value: number | string) =>
  Number(value || 0).toLocaleString('fa-IR');
