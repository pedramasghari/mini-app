'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type TelegramInitDataUnsafe = {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  start_param?: string;
};

type TelegramContextValue = {
  ready: boolean;
  isTelegram: boolean;
};

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram باید داخل TelegramProvider استفاده شود.');
  }
  return context;
}

export function TelegramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const webApp = window.Telegram?.WebApp;

    if (!webApp) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsTelegram(true);
    webApp.ready();
    webApp.expand();

    // Telegram can expose WebApp a little before initData is populated.
    // Wait briefly for it so the first panel request can authenticate reliably.
    const startedAt = Date.now();
    const waitForInitData = () => {
      if (cancelled) return;

      if (webApp.initData || Date.now() - startedAt >= 2000) {
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true);
        });
        return;
      }

      window.setTimeout(waitForInitData, 50);
    };

    waitForInitData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || pathname === '/zibal/status') {
      return;
    }

    const webApp = window.Telegram?.WebApp;

    if (!webApp) {
      return;
    }

    const initDataUnsafe =
      webApp.initDataUnsafe as TelegramInitDataUnsafe;

    const startParam = initDataUnsafe.start_param?.trim();

    if (!startParam?.startsWith('zibal_')) {
      return;
    }

    const ticketId = startParam.slice('zibal_'.length).trim();

    if (!ticketId) {
      return;
    }

    router.replace(
      `/zibal/status?ticketId=${encodeURIComponent(ticketId)}`,
    );
  }, [ready, pathname, router]);

  return (
    <TelegramContext.Provider value={{ ready, isTelegram }}>
      {!ready ? (
        <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-sm text-white/70">
          در حال آماده‌سازی…
        </div>
      ) : (
        children
      )}
    </TelegramContext.Provider>
  );
}
