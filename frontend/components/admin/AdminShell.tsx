'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminGuard from './AdminGuard';

const links = [
  { href: '/admin', label: 'داشبورد' },
  { href: '/admin/support', label: 'پشتیبانی' },
  { href: '/admin/finace', label: 'مالی' },
  { href: '/admin/user', label: 'کاربران' },
  { href: '/admin/orders', label: 'سفارش‌ها' },
  { href: '/admin/services', label: 'سرویس‌ها' },
  { href: '/admin/payments', label: 'درخواست‌های شارژ' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminGuard>
      <main dir="rtl" className="min-h-[100dvh] bg-[#070b14] text-white">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col md:flex-row">
          <aside className="w-full border-b border-white/10 p-4 md:w-64 md:border-b-0 md:border-l">
            <div className="mb-5">
              <div className="text-lg font-bold">پنل مدیریت</div>
              <div className="mt-1 text-xs text-white/50">مدیریت Mini App</div>
            </div>

            <nav className="flex gap-2 overflow-x-auto md:flex-col">
              {links.map((link) => {
                const active = link.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap rounded-xl px-4 py-3 text-sm transition ${
                      active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/panel"
              className="mt-4 block rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/70 hover:bg-white/5 hover:text-white"
            >
              بازگشت به پنل کاربری
            </Link>
          </aside>

          <section className="min-w-0 flex-1 p-4 md:p-6">
            {children}
          </section>
        </div>
      </main>
    </AdminGuard>
  );
}
