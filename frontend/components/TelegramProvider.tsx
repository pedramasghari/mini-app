'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function TelegramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      return;
    }

    const webApp = window.Telegram.WebApp;

    webApp.ready();
    webApp.expand();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || pathname === '/zibal/status' || !window.Telegram?.WebApp) {
      return;
    }

    const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param?.trim();
    if (!startParam || !startParam.startsWith('zibal_')) {
      return;
    }

    const ticketId = startParam.slice('zibal_'.length).trim();
    if (!ticketId) return;

    // Telegram may open the Mini App in a new WebView after the external
    // payment browser redirects to the bot. Do not depend on the previous
    // tab's React state/session storage; route using Telegram's start_param.
    router.replace(`/zibal/status?ticketId=${encodeURIComponent(ticketId)}`);
  }, [ready, pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return children;
}
