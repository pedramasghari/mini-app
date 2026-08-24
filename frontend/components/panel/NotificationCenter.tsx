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
    const onPointerDown = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) onOpenChange(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onOpenChange(false); };
    document.addEventListener('mousedown', onPointerDown); document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open, onOpenChange]);

  const openNotification = async (notification: (typeof notifications)[number]) => {
    await markRead(notification.id);
    const conversationId = (notification.data as { conversationId?: string } | undefined)?.conversationId;
    if (notification.type === 'SUPPORT_MESSAGE') {
      window.location.href = conversationId ? `/panel/support?conversation=${encodeURIComponent(conversationId)}` : '/panel/support';
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="اعلان‌ها" aria-expanded={open} aria-haspopup="menu" onClick={() => onOpenChange(!open)} className={`relative grid h-10 w-10 place-items-center rounded-xl border transition active:scale-95 sm:h-11 sm:w-11 sm:rounded-2xl ${open ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/[.05] text-white/80 hover:bg-white/[.09]'}`}>
        <BellRing size={20} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-400 px-1 text-[9px] font-black text-black">{unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}</span>}
      </button>
      {open && <div role="menu" className="fixed right-0 z-100 flex h-auto w-full flex-col px-4 py-2">
        <div className="w-full rounded-[26px] border border-white/10 bg-black/95">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><b className="text-sm">اعلان‌ها</b><p className="mt-1 text-[10px] text-white/40">{unread.toLocaleString('fa-IR')} اعلان خوانده‌نشده</p></div><button type="button" aria-label="بستن" onClick={() => onOpenChange(false)} className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white/40"><X size={15} /></button></div>
          <div className="max-h-[60vh] min-h-[40vh] overflow-y-auto p-2">
            {notifications.slice(0, 8).map((n) => <button key={n.id} type="button" role="menuitem" onClick={() => void openNotification(n)} className={`block w-full rounded-2xl p-3 text-right transition hover:bg-white/[.07] ${n.read ? 'opacity-50' : 'bg-white/5'}`}><p className="text-xs font-bold">{n.title}</p><p className="mt-1 text-[11px] leading-5 text-white/50">{n.message}</p></button>)}
            {!notifications.length && <p className="p-5 text-center text-xs text-white/40">اعلانی ندارید.</p>}
          </div>
        </div>
      </div>}
    </div>
  );
}
