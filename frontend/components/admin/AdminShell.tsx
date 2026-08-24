"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import AdminGuard from "./AdminGuard";

const links = [
  {
    href: "/admin",
    label: "داشبورد",
    description: "نمای کلی و آمار",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/services",
    label: "سرویس‌ها",
    description: "مدیریت سرویس و محصولات",
    icon: Package,
  },
  {
    href: "/admin/orders",
    label: "سفارش‌ها",
    description: "پیگیری و مدیریت سفارش‌ها",
    icon: ClipboardList,
  },
  {
    href: "/admin/user",
    label: "کاربران",
    description: "مدیریت کاربران",
    icon: Users,
  },
  {
    href: "/admin/finance",
    label: "مالی",
    description: "گزارش‌ها و تراکنش‌ها",
    icon: CircleDollarSign,
  },
  {
    href: "/admin/payments",
    label: "درخواست‌های شارژ",
    description: "بررسی درخواست‌های پرداخت",
    icon: BarChart3,
  },
  {
    href: "/admin/withdrawals",
    label: "درخواست‌های برداشت",
    description: "بررسی درخواست‌های برداشت",
    icon: BarChart3,
  },  
  {
    href: "/admin/support",
    label: "پشتیبانی",
    description: "گفتگوهای کاربران",
    icon: Headphones,
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current =
    links.find((link) => isActive(pathname, link.href)) ?? links[0];
  const CurrentIcon = current.icon;

  return (
    <AdminGuard>
      <div dir="rtl" className="min-h-[100dvh] bg-[#060912] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#060912]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
              aria-label="باز کردن منوی مدیریت"
            >
              <Menu size={21} />
            </button>

            <Link
              href="/admin"
              className="group flex min-w-0 items-center gap-3 rounded-2xl px-1.5 py-1.5 transition hover:bg-white/[0.05]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/10">
                <ShieldCheck size={21} />
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-sm font-extrabold tracking-tight">
                  Mini App
                </span>
                <span className="block text-[11px] text-white/40">
                  مدیریت سیستم
                </span>
              </span>
            </Link>

            <div className="mx-1 hidden h-8 w-px bg-white/10 lg:block" />

            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <CurrentIcon size={17} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {current.label}
                </div>
                <div className="hidden truncate text-[10px] text-white/35 sm:block">
                  {current.description}
                </div>
              </div>
            </div>

            <div className="mr-auto hidden items-center gap-2 sm:flex">
              <div className="hidden items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 lg:flex">
                <Settings2 size={15} className="text-white/35" />
                <span className="text-xs text-white/45">Admin</span>
              </div>
              <Link
                href="/panel"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white"
              >
                خروج از مدیریت
              </Link>
            </div>
          </div>
        </header>

        {drawerOpen && (
          <>
            <button
              type="button"
              aria-label="بستن منوی مدیریت"
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px]"
            />
            <aside className="fixed right-0 top-0 z-[80] flex h-[100dvh] w-[min(380px,92vw)] flex-col border-l border-white/10 bg-[#0a101c]/98 shadow-2xl shadow-black/60 backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <div className="font-black">پنل مدیریت</div>
                    <div className="mt-0.5 text-[11px] text-white/35">
                      Mini App Administration
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="بستن"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="border-b border-white/[0.06] px-5 py-4">
                <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                      <CurrentIcon size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{current.label}</div>
                      <div className="truncate text-[11px] text-white/35">
                        {current.description}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto p-4">
                <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-white/25">
                  مدیریت
                </div>
                <div className="grid gap-1.5">
                  {links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${active ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-cyan-400/10" : "text-white/60 hover:bg-white/[0.05] hover:text-white"}`}
                      >
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-cyan-400/15" : "bg-white/[0.04]"}`}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {link.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-white/30">
                            {link.description}
                          </span>
                        </span>
                        {active && (
                          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-lg shadow-cyan-300/50" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              <div className="border-t border-white/[0.08] p-4">
                <Link
                  href="/panel"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-3 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.04]">
                    <LogOut size={17} />
                  </span>
                  <span>بازگشت به پنل کاربری</span>
                </Link>
              </div>
            </aside>
          </>
        )}

        <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="min-w-0">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
