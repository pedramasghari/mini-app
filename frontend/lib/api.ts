type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
};

const API_TIMEOUT_MS = 8000;
const TELEGRAM_INIT_DATA_WAIT_MS = 2500;

function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.initData || null;
}

function waitForTelegramInitData(timeoutMs = TELEGRAM_INIT_DATA_WAIT_MS): Promise<string | null> {
  const immediate = getTelegramInitData();
  if (immediate) return Promise.resolve(immediate);
  if (typeof window === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const startedAt = Date.now();
    let timer: number | undefined;

    const check = () => {
      const initData = getTelegramInitData();
      if (initData || Date.now() - startedAt >= timeoutMs) {
        if (timer) window.clearTimeout(timer);
        resolve(initData);
        return;
      }
      timer = window.setTimeout(check, 50);
    };

    check();
  });
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  // Respect an existing caller signal while still enforcing our timeout.
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeout);
  });
}

async function authenticateTelegram(): Promise<boolean> {
  const initData = await waitForTelegramInitData();
  if (!initData) return false;

  const response = await fetchWithTimeout('/api/auth/telegram', {
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

function getFriendlyRequestError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('ارتباط با سرور بیش از حد طول کشید. لطفاً دوباره تلاش کنید.');
  }

  if (error instanceof TypeError) {
    return new Error('ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.');
  }

  return error instanceof Error ? error : new Error('خطای نامشخص در ارتباط با سرور.');
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const request = () => fetchWithTimeout(`/api/${path}`, {
    credentials: 'include',
    ...options,
  });

  let response: Response;

  try {
    response = await request();
  } catch (error) {
    throw getFriendlyRequestError(error);
  }

  // `/panel` can be opened directly without visiting `/` first. Recover the
  // session from Telegram initData once, then retry the original request.
  if (response.status === 401 && path !== 'auth/telegram') {
    try {
      if (await authenticateTelegram()) {
        response = await request();
      }
    } catch (error) {
      throw getFriendlyRequestError(error);
    }
  }

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw getFriendlyRequestError(error);
  }

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
