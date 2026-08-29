'use client';

import { useEffect, useState } from 'react';
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

export function TelegramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (!webApp) {
      setReady(true);
      return;
    }

    webApp.ready();
    webApp.expand();

    requestAnimationFrame(() => {
      setReady(true);
    });
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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return children;
}