'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    async function login() {
      const initData =
        window.Telegram.WebApp.initData;

      if (!initData) {
        console.error(
          'Telegram initData is missing',
        );

        return;
      }

      const response = await fetch(
        `api/auth/telegram`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          credentials: 'include',

          body: JSON.stringify({
            initData,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          'Telegram authentication failed',
        );
      }

      const data =
        await response.json();

      console.log(
        'Authenticated user:',
        data,
      );

      window.location.href =
        '/panel';
    }

    login();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div>
        Connecting to Telegram...
      </div>
    </main>
  );
}