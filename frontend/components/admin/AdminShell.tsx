"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
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
  { href: "/admin", label: "داشبورد", description: "نمای کلی و آمار", icon: LayoutDashboard },
  { href: "/admin/services", label: "سرویس‌ها", description: "مدیریت سرویس و محصولات", icon: Package },
  { href: "/admin/orders", label: "سفارش‌ها", description: "پیگیری و مدیریت سفارش‌ها", icon: ClipboardList },
  { href: "/admin/user", label: "کاربران", description: "مدیریت کاربران", icon: Users },
  { href: "/admin/finance", label: "مالی", description: "گزارش‌ها و تراکنش‌ها", icon: CircleDollarSign },
  { href: "/admin/payments", label: "درخواست‌های شارژ", description: "بررسی درخواست‌های پرداخت", icon: BarChart3 },
  { href: "/admin/support", label: "پشتیبانی", description: "تیکت‌ها و درخواست‌ها", icon: Headphones },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = links.find((link) => isActive(pathname, link.href)) ?? links[0];
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
            <Link href="/admin" className="group flex shrink-0 items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-white/[0.05]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/10">
                <ShieldCheck size={21} />
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-extrabold tracking-tight">Mini App</span>
                <span className="block text-[11px] text-white/40">مدیریت سیستم</span>
              </span>
            </Link>

            <div className="mx-1 hidden h-8 w-px bg-white/10 lg:block" />

            <div className="relative mr-auto">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex min-w-[190px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-right shadow-sm transition hover:border-white/20 hover:bg-white/[0.07]"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-cyan-300">
                    <CurrentIcon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{current.label}</span>
                    <span className="hidden truncate text-[10px] text-white/40 sm:block">{current.description}</span>
                  </span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-white/40 transition ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  <button aria-label="بستن منو" className="fixed inset-0 cursor-default" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-[calc(100%+10px)] z-[60] w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/10 bg-[#0b111e]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl" role="menu">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30">منوی مدیریت</div>
                    <div className="grid gap-1">
                      {links.map((link) => {
                        const Icon = link.icon;
                        const active = isActive(pathname, link.href);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            role="menuitem"
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-cyan-400/10 text-cyan-200" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
                          >
                            <span className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-cyan-400/15" : "bg-white/[0.05]"}`}>
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{link.label}</span>
                              <span className="block truncate text-[10px] text-white/35">{link.description}</span>
                            </span>
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />}
                          </Link>
                        );
                      })}
                    </div>
                    <div className="my-2 h-px bg-white/[0.07]" />
                    <Link href="/panel" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.06] hover:text-white">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05]"><LogOut size={17} /></span>
                      بازگشت به پنل کاربری
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <div className="hidden items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 lg:flex">
                <Settings2 size={15} className="text-white/35" />
                <span className="text-xs text-white/45">Admin</span>
              </div>
              <Link href="/panel" className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white">
                خروج از مدیریت
              </Link>
            </div>

            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/70 sm:hidden" aria-label="منوی مدیریت">
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-white/35">
                <span>مدیریت</span><span>/</span><span className="text-white/55">{current.label}</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{current.label}</h1>
              <p className="mt-1 text-sm text-white/40">{current.description}</p>
            </div>
            <button type="button" onClick={() => router.refresh()} className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white sm:block">
              بروزرسانی
            </button>
          </div>

          <div className="min-w-0">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
