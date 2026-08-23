'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    api<{ allowed: boolean }>('admin/access')
      .then((result) => {
        if (!active) return;
        if (result.allowed) {
          setAllowed(true);
          return;
        }
        router.replace('/panel');
      })
      .catch(() => {
        if (active) router.replace('/panel');
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return (
      <main dir="rtl" className="grid min-h-[100dvh] place-items-center bg-[#070b14] text-white">
        در حال بررسی دسترسی…
      </main>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
