"use client";
import { useState } from "react";
import { usePanel } from "@/context/PanelContext";
import { BellRing } from "lucide-react";
export default function NotificationCenter() {
  const { notifications, markRead } = usePanel();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="اعلان‌ها"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-xl transition hover:bg-white/15"
      >
        <BellRing className="text-white/80" size={20} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-400 px-1 text-[9px] font-black text-black">
            {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 -translate-x-1/2 top-14 z-50 w-80 rounded-3xl border border-white/10 bg-[#111827]/95 p-2 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between px-3 py-3">
            <b>اعلان‌ها</b>
            <span className="text-xs text-white/40">
              {unread.toLocaleString("fa-IR")} خوانده‌نشده
            </span>
          </div>
          {notifications.slice(0, 8).map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`block w-full rounded-2xl p-3 text-right ${n.read ? "opacity-50" : "bg-white/5"}`}
            >
              <p className="text-xs font-bold">{n.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-white/50">
                {n.message}
              </p>
            </button>
          ))}
          {!notifications.length && (
            <p className="p-5 text-center text-xs text-white/40">
              اعلانی ندارید.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
