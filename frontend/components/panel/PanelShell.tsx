"use client";

import Link from "next/link";
import { usePanel } from "@/context/PanelContext";
import PanelView from "./panelView";
import { AnimatePresence, motion } from "framer-motion";

export default function PanelShell() {
  const { me } = usePanel();

  if (!me)
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center overflow-x-hidden bg-[#070b14] px-4 text-white"
      >
        در حال بارگذاری…
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
          <PanelView me={me} />,
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
