"use client";

import { usePanel } from "@/context/PanelContext";

import DepositModal from "./DepositModal";

import { useAppStore } from "@/context/useApp";
import PanelView from "./panelView";
import { AnimatePresence, motion } from "framer-motion";

export default function PanelShell() {
  const { me } = usePanel();

  const { activeTab } = useAppStore();
  if (!me)
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center overflow-x-hidden bg-[#070b14] px-4 text-white"
      >
        در حال بارگذاری…
      </main>
    );
  const views: Record<string, React.ReactNode> = {
    home: <PanelView me={me} />,
    deposit: <DepositModal />,
    withdraw: <></>,
  };
  return (
    <main
      dir="rtl"
      className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#070b14] text-white"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 0, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="h-full w-full relative inset-0 owerflow-hidden"
        >
          {views[activeTab] || (
            <div className="p-4 text-white">در حال ساخت...</div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
