'use client';

import {
  useEffect,
  useState,
} from 'react';

export function TelegramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    if (!window.Telegram?.WebApp) {
      return;
    }

    const webApp =
      window.Telegram.WebApp;

    webApp.ready();

    webApp.expand();

    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return children;
}