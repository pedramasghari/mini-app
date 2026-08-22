'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function login() {
      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) {
        if (!cancelled) setError('این صفحه باید از داخل Telegram Mini App باز شود.');
        return;
      }

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ initData }),
        });

        if (!response.ok) throw new Error('Telegram authentication failed');
        router.replace('/panel');
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('ورود با Telegram انجام نشد.');
      }
    }

    login();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        {!error && <p>Connecting to Telegram...</p>}
        {error && <p className="text-sm">{error}</p>}
      </div>
    </main>
  );
}
