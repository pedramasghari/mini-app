import { usePanel } from "@/context/PanelContext";
import NotificationCenter from "../panel/NotificationCenter";
import { WalletCards, WalletMinimal } from "lucide-react";
import { initials } from "@/lib/helper";
import { ChevronDown } from "lucide-react";
import { WalletCenter } from "../wallet/walletcenter";
export default function Header() {
  const { me, realtime, notifications } = usePanel();
  if (!me)
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center overflow-x-hidden bg-[#070b14] px-4 text-white"
      >
        در حال بارگذاری…
      </main>
    );

  const { user, wallet } = me;
  const unread = notifications.filter((item) => !item.read).length;
  return (
    <header className="sticky top-0 z-30 -mx-3 mb-4 flex min-w-0 items-center justify-between gap-2 border-b border-white/5 bg-[#070b14]/90 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold text-cyan-300/70">
          فروشگاه
        </p>
        <h1 className="truncate text-base font-black sm:text-lg">داشبورد</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" dir="ltr">
        <div className="relative">
          {/* Realtime status */}

          <button
            type="button"
            aria-label="پروفایل کاربر"
            className="
      group flex min-w-0 items-center gap-2
      rounded-2xl border border-white/10
      bg-white/[0.05]
      px-1.5 py-1.5
      transition-all duration-200
      hover:border-white/20
      hover:bg-white/[0.09]
      active:scale-[0.97]
      sm:gap-2.5 sm:px-2 sm:py-2
    "
          >
            {/* Avatar */}
            <div className="relative">
              <span
                title={realtime ? "اتصال لحظه‌ای فعال است" : "در حال اتصال"}
                className={[
                  "absolute bottom-0 right-0 z-20",
                  "h-2.5 w-2.5 rounded-full",
                  "border-2 border-[#070b14]",
                  realtime ? "bg-emerald-400" : "bg-amber-400",
                  realtime ? "shadow-[0_0_8px_rgba(52,211,153,.7)]" : "",
                ].join(" ")}
              />
              <span
                className="
         grid h-9 w-9 shrink-0
        place-items-center overflow-hidden
        rounded-xl
        bg-gradient-to-br from-cyan-300 to-blue-600
        text-xs font-black text-black
        ring-1 ring-white/10
        sm:h-10 sm:w-10
      "
              >
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={
                      [user.firstName, user.lastName]
                        .filter(Boolean)
                        .join(" ") || "پروفایل کاربر"
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(user)
                )}
              </span>
            </div>

            {/* User information - desktop */}
            <span className="min-w-0 text-right ">
              <span className="block max-w-[110px] truncate text-xs font-bold text-white">
                {user.firstName || user.lastName
                  ? [user.firstName, user.lastName].filter(Boolean).join(" ")
                  : "کاربر تلگرام"}
              </span>

              <span className="mt-0.5 block max-w-[110px] truncate text-[10px] text-white/40">
                {user.username ? `@${user.username}` : "حساب تلگرام"}
              </span>
            </span>

            {/* Chevron */}
            <ChevronDown
              size={15}
              strokeWidth={1.8}
              className="
        shrink-0
        text-white/35
        transition-transform duration-200
        group-hover:text-white/70
        sm:block
      "
            />
          </button>
        </div>
        <WalletCenter balance={wallet?.balance} />
        <NotificationCenter />
      </div>
    </header>
  );
}
