'use client';

import { useEffect, useRef } from 'react';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  CircleUserRound,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { initials } from '@/lib/helper';

interface ProfileCenterProps {
  user: {
    firstName: string | null;
    lastName: string | null;
    username?: string | null;
    photoUrl?: string | null;
  };
  realtime: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout?: () => void;
}

export default function ProfileCenter({ user, realtime, open, onOpenChange, onLogout }: ProfileCenterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'کاربر تلگرام';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    window.location.href = path;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="منوی پروفایل"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
        className="group flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.05] px-1.5 py-1.5 transition hover:border-white/20 hover:bg-white/[.09] active:scale-[.97] sm:gap-2.5 sm:px-2 sm:py-2"
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 text-xs font-black text-black ring-1 ring-white/10 sm:h-10 sm:w-10">
          <span className={`absolute bottom-0 left-0 z-20 h-2.5 w-2.5 rounded-full border-2 border-[#070b14] ${realtime ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]' : 'bg-amber-400'}`} />
          {user.photoUrl ? <img src={user.photoUrl} alt={name} className="h-full w-full object-cover" /> : initials(user)}
        </span>
        <span className="hidden min-w-0 text-right sm:block">
          <span className="block max-w-[110px] truncate text-xs font-bold text-white">{name}</span>
          <span className="mt-0.5 block max-w-[110px] truncate text-[10px] text-white/40">{user.username ? `@${user.username}` : 'حساب تلگرام'}</span>
        </span>
        <ChevronDown size={15} className={`hidden shrink-0 text-white/35 transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-[26px] border border-white/10 bg-[#111827]/98 p-2 shadow-2xl backdrop-blur-2xl sm:left-auto sm:right-0 sm:w-80">
          <div className="rounded-2xl bg-white/[.04] p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/10 text-cyan-200">
                {user.photoUrl ? <img src={user.photoUrl} alt={name} className="h-full w-full object-cover" /> : <CircleUserRound size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{name}</p>
                <p className="mt-1 truncate text-[11px] text-white/40">{user.username ? `@${user.username}` : 'حساب تلگرام'}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> آنلاین</span>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <button type="button" role="menuitem" onClick={() => go('/panel/profile')} className="menu-item"><UserRound size={17} /> پروفایل من</button>
            <button type="button" role="menuitem" onClick={() => go('/panel/orders')} className="menu-item"><ClipboardList size={17} /> سفارش‌های من</button>
            <button type="button" role="menuitem" onClick={() => go('/panel/notifications')} className="menu-item"><Bell size={17} /> اعلان‌ها</button>
            <button type="button" role="menuitem" onClick={() => go('/panel/settings')} className="menu-item"><Settings size={17} /> تنظیمات</button>
          </div>

          <div className="my-2 border-t border-white/10" />
          <div className="rounded-xl bg-cyan-400/[.06] px-3 py-2 text-[10px] leading-5 text-white/45">
            <ShieldCheck size={14} className="mb-1 text-cyan-300" /> حساب شما با اتصال تلگرام محافظت می‌شود.
          </div>
          <button type="button" role="menuitem" onClick={() => { onOpenChange(false); onLogout?.(); }} className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold text-red-300 transition hover:bg-red-400/10"><LogOut size={17} /> خروج از حساب</button>
        </div>
      )}
    </div>
  );
}
