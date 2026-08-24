"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, fa } from "../../lib/api";

type Overview = {
  smscode: {
    balance: string | null;
    currency: string | null;
    available: boolean;
    error?: string;
  };
  usersBalance: string;
  walletCount: number;
  totalReceived: string;
  totalWithdrawals: string;
  serviceRevenue: {
    standardOrders: string;
    smsCodeOrders: string;
    total: string;
  };
};
type Transaction = {
  id: string;
  userId: string;
  walletId: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
  } | null;
};
type TransactionsResponse = {
  items: Transaction[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};
type Status = { type: string; count: number };
const labels: Record<string, string> = {
  DEPOSIT: "واریز",
  PAYMENT_DEPOSIT: "واریز",
  PURCHASE: "خرید سرویس",
  SMSCODE_ORDER_DEBIT: "خرید شماره",
  SMSCODE_ORDER_REFUND: "بازگشت وجه",
  REFUND: "بازگشت وجه",
  WITHDRAW: "برداشت",
  WITHDRAWAL: "برداشت",
};
const typeLabel = (type: string) => labels[type] ?? type.replaceAll("_", " ");
const money = (value: string | number, currency = "IRT") =>
  `${fa(Number(value || 0))} ${currency}`;
const date = (value: string) =>
  new Date(value).toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function AdminFinance() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [telegramId, setTelegramId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  async function loadOverview() {
    setOverview(await api<Overview>("admin/finance/overview"));
  }
  async function loadTransactions(nextPage = page) {
    const params = new URLSearchParams({ page: String(nextPage), limit: "10" });
    if (telegramId.trim()) params.set("telegramId", telegramId.trim());
    if (status) params.set("status", status);
    setLoading(true);
    try {
      setData(
        await api<TransactionsResponse>(
          `admin/finance/transactions?${params.toString()}`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadOverview(), loadTransactions(page)]);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void Promise.all([
      loadOverview(),
      loadTransactions(1),
      api<Status[]>("admin/finance/transactions/statuses").then(setStatuses),
    ]);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void loadTransactions(page), 250);
    return () => window.clearTimeout(t);
  }, [page, status]);
  const visibleStatuses = useMemo(() => statuses.slice(0, 12), [statuses]);
  return (
    <div dir="rtl" className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#101a28] via-[#0d141f] to-[#0a0f18] p-5 sm:p-7">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-cyan-300/70">
              <CircleDollarSign size={15} /> مرکز مالی
            </div>
            <h2 className="text-2xl font-black sm:text-3xl">
              گزارش مالی و گردش حساب
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
              نمای لحظه‌ای موجودی‌ها، درآمد فروش سرویس، و تراکنش‌های کاربران با
              امکان پیگیری سفارش.
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{" "}
            بروزرسانی
          </button>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={Server}
          title="بالانس SMSCode"
          value={
            overview?.smscode.available
              ? money(
                  overview.smscode.balance ?? 0,
                  overview.smscode.currency ?? "",
                )
              : "در دسترس نیست"
          }
          hint={overview?.smscode.error}
        />
        <Metric
          icon={Banknote}
          title="مجموع دریافتی‌ها"
          value={money(overview?.totalReceived ?? 0)}
          hint="مجموع واریزهای تأییدشده"
        />
        <Metric
          icon={WalletCards}
          title="بالانس کاربران"
          value={money(overview?.usersBalance ?? 0)}
          hint={`${fa(overview?.walletCount ?? 0)} کیف پول`}
        />
        <Metric
          icon={ArrowUpRight}
          title="مجموع Withdraw"
          value={money(overview?.totalWithdrawals ?? 0)}
          hint="تراکنش‌های برداشت ثبت‌شده"
        />
        <Metric
          icon={ShoppingBag}
          title="درآمد فروش سرویس"
          value={money(overview?.serviceRevenue.total ?? 0)}
          hint="فروش سرویس + سفارش‌های SMSCode"
        />
      </section>
      <section className="rounded-[26px] border border-white/10 bg-[#0b111a] p-4 shadow-xl shadow-black/10 sm:p-5">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black">تراکنش‌های اخیر</h3>
            <p className="mt-1 text-xs text-white/35">
              در هر صفحه ۱۰ تراکنش آخر نمایش داده می‌شود.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1 lg:w-[280px]">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25"
              />
              <input
                value={telegramId}
                onChange={(e) => {
                  setTelegramId(e.target.value);
                  setPage(1);
                }}
                placeholder="فیلتر با Telegram ID"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pr-10 pl-3 text-sm outline-none transition focus:border-cyan-400/30"
              />
            </div>
            <div className="relative">
              <Filter
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/25"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-11 min-w-[175px] appearance-none rounded-xl border border-white/10 bg-[#101823] px-9 pl-8 text-sm text-white/70 outline-none"
              >
                <option value="">همه وضعیت‌ها</option>
                {visibleStatuses.map((item) => (
                  <option key={item.type} value={item.type}>
                    {typeLabel(item.type)} ({item.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-white/[0.025] text-[11px] text-white/35">
              <tr>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">نوع</th>
                <th className="px-4 py-3 font-medium">مبلغ</th>
                <th className="px-4 py-3 font-medium">موجودی بعد</th>
                <th className="px-4 py-3 font-medium">شرح</th>
                <th className="px-4 py-3 font-medium">زمان</th>
                <th className="px-4 py-3 font-medium">پیگیری</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="h-48 text-center">
                    <Loader2 className="mx-auto animate-spin text-cyan-300" />
                  </td>
                </tr>
              ) : (
                data?.items.map((item) => (
                  <TransactionRow key={item.id} item={item} />
                ))
              )}
              {!loading && !data?.items.length && (
                <tr>
                  <td colSpan={7} className="h-48 text-center text-white/30">
                    تراکنشی با این فیلتر پیدا نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={data?.page ?? 1}
          pages={data?.pages ?? 1}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </section>
    </div>
  );
}
function Metric({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-[#0b111a] p-4 transition hover:-translate-y-0.5 hover:border-cyan-400/15">
      <div className="mb-4 flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Icon size={18} />
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="text-xs text-white/40">{title}</div>
      <div className="mt-1 truncate text-xl font-black tracking-tight">
        {value}
      </div>
      <div className="mt-2 truncate text-[10px] text-white/20">
        {hint || "—"}
      </div>
    </div>
  );
}
function TransactionRow({ item }: { item: Transaction }) {
  const positive = Number(item.amount) >= 0;
  const name =
    [item.user?.firstName, item.user?.lastName].filter(Boolean).join(" ") ||
    item.user?.username ||
    "کاربر";
  const canOpen = Boolean(
    item.referenceId &&
    ["ORDER", "SMSCODE_ORDER", "SMSCODE_ORDER_REFUND"].includes(
      item.referenceType ?? "",
    ),
  );
  const kind = item.referenceType?.toUpperCase().includes("SMSCODE")
    ? "SMSCODE"
    : undefined;
  return (
    <tr className="transition hover:bg-white/[0.025]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.06] text-xs font-bold text-white/60">
            {item.user?.photoUrl ? (
              <img
                src={item.user.photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              name.slice(0, 1)
            )}
          </div>
          <div>
            <div className="font-semibold">{name}</div>
            <div className="mt-0.5 text-[10px] text-white/30">
              {item.user?.telegramId || "—"}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${positive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}
        >
          {typeLabel(item.type)}
        </span>
      </td>
      <td
        className={`px-4 py-3 font-bold ${positive ? "text-emerald-300" : "text-rose-300"}`}
      >
        {positive ? "+" : ""}
        {money(item.amount, item.currency)}
      </td>
      <td className="px-4 py-3 text-white/55">
        {money(item.balanceAfter, item.currency)}
      </td>
      <td className="max-w-[220px] truncate px-4 py-3 text-white/40">
        {item.description || "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-white/35">
        {date(item.createdAt)}
      </td>
      <td className="px-4 py-3">
        {canOpen ? (
          <Link
            href={`/admin/orders?orderId=${encodeURIComponent(item.referenceId!)}${kind ? `&kind=${kind}` : ""}`}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-cyan-300 transition hover:bg-cyan-400/10"
          >
            مشاهده <ArrowLeft size={12} />
          </Link>
        ) : (
          <span className="text-[10px] text-white/20">بدون سفارش</span>
        )}
      </td>
    </tr>
  );
}
function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1)
    return (
      <div className="mt-4 text-center text-[11px] text-white/25">
        {fa(total)} تراکنش
      </div>
    );
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from(
    { length: Math.min(5, pages) },
    (_, i) => start + i,
  ).filter((n) => n <= pages);
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[11px] text-white/30">
        صفحه {fa(page)} از {fa(pages)} · {fa(total)} تراکنش
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 disabled:opacity-25"
        >
          <ChevronRight size={15} />
        </button>
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-xs ${n === page ? "bg-cyan-400 font-black text-[#031013]" : "border border-white/10 text-white/45 hover:bg-white/5"}`}
          >
            {fa(n)}
          </button>
        ))}
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 disabled:opacity-25"
        >
          <ChevronLeft size={15} />
        </button>
      </div>
    </div>
  );
}
