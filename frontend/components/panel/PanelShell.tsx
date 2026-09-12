"use client";

import Link from "next/link";
import { usePanel } from "@/context/PanelContext";
import PanelView from "./panelView";
import { AnimatePresence, motion } from "framer-motion";

export default function PanelShell() {
  const { me, loading, error, refresh } = usePanel();

  if (loading && !me)
    return (
      <main
        dir="rtl"
        className="grid min-h-[100dvh] place-items-center overflow-x-hidden bg-[#070b14] px-4 text-white"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <span className="text-sm text-white/70">در حال ورود به حساب…</span>
        </div>
      </main>
    );

  if (!me)
    return (
      <main
        dir="rtl"
        className="grid min-h-[100dvh] place-items-center overflow-x-hidden bg-[#070b14] px-4 text-white"
      >
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4">
            <p className="text-sm font-medium text-red-200">ورود به حساب انجام نشد</p>
            <p className="mt-2 text-xs leading-6 text-white/60">
              {error || 'ارتباط با حساب کاربری برقرار نشد.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh().catch(() => undefined)}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-[#070b14] transition hover:bg-white/90"
          >
            تلاش دوباره
          </button>
        </div>
      </main>
    );

  return (
    <main
      dir="rtl"
      className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#070b14] text-white"
    >
      {me.isAdmin && (
        <div className="sticky top-0 z-40 flex justify-start px-4 pt-3">
          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 backdrop-blur hover:bg-white/10 hover:text-white"
          >
            پنل مدیریت
          </Link>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative inset-0 h-full w-full overflow-hidden"
        >
          <PanelView me={me} />
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
