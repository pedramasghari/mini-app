'use client';

import { useEffect, useState } from 'react';

type User = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

type Wallet = {
  id: string;
  balance: string;
  currency: string;
};

export default function PanelPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [wallet, setWallet] =
    useState<Wallet | null>(null);

  useEffect(() => {
    async function load() {
      // فعلاً برای نمونه بعداً
      // /auth/telegram response را نگه می‌داریم.
    }

    load();
  }, []);

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto max-w-md space-y-4">

        <section className="rounded-2xl border p-5">
          <h1 className="text-xl font-bold">
            Profile
          </h1>

          <div className="mt-4">
            <div>
              {user?.firstName ?? 'Telegram User'}
            </div>

            {user?.username && (
              <div className="text-sm opacity-60">
                @{user.username}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="font-bold">
            Wallet
          </h2>

          <div className="mt-4 text-3xl font-bold">
            {wallet?.balance ?? '0.00'}
          </div>

          <div className="text-sm opacity-60">
            {wallet?.currency ?? 'USD'}
          </div>
        </section>

      </div>
    </main>
  );
}