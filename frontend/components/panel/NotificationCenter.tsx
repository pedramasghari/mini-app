'use client';
import { useEffect, useRef } from 'react';
import { usePanel } from '@/context/PanelContext';
import { BellRing, X } from 'lucide-react';

export default function NotificationCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { notifications, markRead } = usePanel();
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

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

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="اعلان‌ها" aria-expanded={open} aria-haspopup="menu" onClick={() => onOpenChange(!open)} className={`relative grid h-10 w-10 place-items-center rounded-xl border transition active:scale-95 sm:h-11 sm:w-11 sm:rounded-2xl ${open ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/[.05] text-white/80 hover:bg-white/[.09]'}`}>
        <BellRing size={20} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-400 px-1 text-[9px] font-black text-black">{unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}</span>}
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[26px] border border-white/10 bg-[#111827]/98 shadow-2xl backdrop-blur-2xl sm:left-auto sm:right-0 sm:w-80">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div><b className="text-sm">اعلان‌ها</b><p className="mt-1 text-[10px] text-white/40">{unread.toLocaleString('fa-IR')} اعلان خوانده‌نشده</p></div>
            <button type="button" aria-label="بستن" onClick={() => onOpenChange(false)} className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white/40"><X size={15} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {notifications.slice(0, 8).map((n) => <button key={n.id} type="button" role="menuitem" onClick={() => markRead(n.id)} className={`block w-full rounded-2xl p-3 text-right transition hover:bg-white/[.07] ${n.read ? 'opacity-50' : 'bg-white/5'}`}><p className="text-xs font-bold">{n.title}</p><p className="mt-1 text-[11px] leading-5 text-white/50">{n.message}</p></button>)}
            {!notifications.length && <p className="p-5 text-center text-xs text-white/40">اعلانی ندارید.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
