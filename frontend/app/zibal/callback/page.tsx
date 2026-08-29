"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export default function ZibalCallback() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentId = searchParams.get("paymentId");
    const trackId = searchParams.get("trackId");

    if (trackId) {
      window.location.replace(`/zibal/status?ticketId=${encodeURIComponent(trackId)}`);
      return;
    }

    if (!trackId) {
      setError("شناسه پرداخت از زیبال دریافت نشد.");
      return;
    }

    let cancelled = false;
    void api<{ payment?: { id?: string } }>(
      `zibal/callback?trackId=${encodeURIComponent(trackId)}`,
    )
      .then((result) => {
        if (cancelled) return;
        const id = result.payment?.id;
        if (!id) throw new Error("شناسه تراکنش پیدا نشد.");
        window.location.replace(`/zibal/status?ticketId=${encodeURIComponent(id)}`);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "بررسی پرداخت انجام نشد.");
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main dir="rtl" className="grid min-h-[100dvh] place-items-center bg-[#070b14] px-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.04] p-7 text-center shadow-2xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-300" />
        <h1 className="mt-5 text-xl font-black">در حال بررسی پرداخت</h1>
        <p className="mt-3 text-sm leading-7 text-white/45">
          نتیجه پرداخت در سمت سرور بررسی می‌شود و همین صفحه به وضعیت تراکنش منتقل خواهد شد.
        </p>
        {error && <p className="mt-5 rounded-2xl bg-red-400/10 p-4 text-xs leading-6 text-red-200">{error}</p>}
      </section>
    </main>
  );
}
