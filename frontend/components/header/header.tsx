"use client";

import { useState } from "react";
import { usePanel } from "@/context/PanelContext";
import NotificationCenter from "../panel/NotificationCenter";
import { WalletCenter } from "../wallet/walletcenter";
import ProfileCenter from "../profile/ProfileCenter";

export default function Header() {
  const go = (path: string) => {
    window.location.href = path;
  };
  const onDeposit = () => go("/panel/deposit");
  const onWithdraw = () => go("/panel/withdraw");
  const onTransactions = () => go("/panel/transactions");
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
      className="sticky top-0 z-50 -mx-3 mb-4 flex min-w-0 items-center justify-between gap-2 border-b border-white/5 bg-[#070b14]/90 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5"
    >
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold text-cyan-300/70">
          فروشگاه
        </p>
        <h1 className="truncate text-base font-black sm:text-lg">داشبورد</h1>
      </div>

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
