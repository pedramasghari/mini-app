"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import SmsOrderCard, { SmsOrderCardData } from "@/components/service/SmsOrderCard";

export default function ActiveNumberOrders() {
  const [orders, setOrders] = useState<SmsOrderCardData[]>([]);

  const load = useCallback(async () => {
    try {
      const next = await api<SmsOrderCardData[]>("number-orders/active");
      setOrders(next);
    } catch {
      // صفحه اصلی نباید به خاطر خطای این ویجت مختل شود.
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!orders.length) return null;

  return (
    <section className="mt-5" dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-cyan-300/60">شماره‌های فعال</p>
          <h2 className="mt-1 text-base font-black">شماره‌های در حال استفاده</h2>
        </div>
        <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">{orders.length} فعال</span>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {orders.map((order) => (
          <div key={order.id} className="shrink-0 snap-start">
            <SmsOrderCard
              order={order}
              onChange={(next) => setOrders((current) => current.map((item) => item.id === next.id ? next : item))}
              onRemove={() => setOrders((current) => current.filter((item) => item.id !== order.id))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
