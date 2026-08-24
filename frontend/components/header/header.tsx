"use client";

import { useState } from "react";
import { usePanel } from "@/context/PanelContext";
import NotificationCenter from "../panel/NotificationCenter";
import { WalletCenter } from "../wallet/walletcenter";
import ProfileCenter from "../profile/ProfileCenter";
import { useAppStore } from "@/context/useApp";
import { ShoppingBag } from "lucide-react";

export default function Header() {
  const { activeTab, setActiveTab } = useAppStore();
  const go = (path: string) => {
    window.location.href = path;
  };
  const onDeposit = () => {setActiveTab("deposit"); go("/panel");}
  const onWithdraw = () => {setActiveTab("withdraw"); go("/panel");}
  const onTransactions = () => {setActiveTab("transactions"); go("/panel");}
  const onLogout = () => go("/logout");
  const { me, realtime } = usePanel();
  const [activeMenu, setActiveMenu] = useState<
    "wallet" | "notifications" | "profile" | null
  >(null);

  if (!me) return null;

  const { user, wallet } = me;
  const setMenu = (menu: typeof activeMenu) =>
    setActiveMenu((current) => (current === menu ? null : menu));

  return (
    <header
      dir="rtl"
      className="sticky  top-0 z-50 -mx-3 mb-4 flex min-w-0 items-center justify-between gap-2 border-b border-white/5 bg-[#070b14]/90 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5"
    >
      <button className="min-w-0 cursor-pointer border border-1 border-[#333] hover:bg-white/10 p-2 rounded-xl flex gap-2 justify-content items-center" onClick={() => {setActiveTab("home"); go("/panel");}}>
        <ShoppingBag size={20} className="text-white" />
        <p className="truncate text-lg font-bold text-white">
          فروشگاه
        </p>
      </button>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
        <WalletCenter
          balance={wallet?.balance}
          open={activeMenu === "wallet"}
          onOpenChange={(open) => setMenu(open ? "wallet" : null)}
          onDeposit={onDeposit}
          onWithdraw={onWithdraw}
          onTransactions={onTransactions}
        />

        <NotificationCenter
          open={activeMenu === "notifications"}
          onOpenChange={(open) => setMenu(open ? "notifications" : null)}
        />

        <ProfileCenter
          user={user}
          realtime={realtime}
          open={activeMenu === "profile"}
          onOpenChange={(open) => setMenu(open ? "profile" : null)}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
