'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
};

type Wallet = {
  id: string;
  balance: string;
  currency: string;
};

export default function PanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok) throw new Error('Could not load account');

      const data = await response.json();
      setUser(data.user);
      setWallet(data.wallet);
      setLoading(false);
    }

    load().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center p-6">Loading account...</main>;
  }

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-2xl border p-5">
          <p className="text-sm opacity-60">Profile</p>
          <h1 className="mt-2 text-xl font-bold">
            {user?.firstName} {user?.lastName ?? ''}
          </h1>
          {user?.username && <p className="mt-1 text-sm opacity-60">@{user.username}</p>}
          <p className="mt-3 text-xs opacity-50">Telegram ID: {user?.telegramId}</p>
        </section>

        <section className="rounded-2xl border p-5">
          <p className="text-sm opacity-60">Wallet</p>
          <div className="mt-3 text-3xl font-bold">{wallet?.balance ?? '0.00'}</div>
          <p className="mt-1 text-sm opacity-60">{wallet?.currency ?? 'USD'}</p>
        </section>
      </div>
    </main>
  );
}
