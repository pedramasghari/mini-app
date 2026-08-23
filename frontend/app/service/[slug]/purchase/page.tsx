"use client";

import Link from "next/link";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useServiceStore } from "@/store/serviceStore";
import { api } from "@/lib/api";
import type { Guide } from "@/components/panel/types";
import AppleServicePurchase from "@/components/service/AppleServicePurchase";

export default function ServicePurchasePage() {
  const { selectedService, selectedProduct } = useServiceStore();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedProduct?.id || selectedProduct.requiresGuide === false) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Guide>(`products/${selectedProduct.id}/guide`)
      .then((data) => {
        if (!cancelled) setGuide(data);
      })
      .catch((error) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "راهنمای سرویس دریافت نشد.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.id, selectedProduct?.requiresGuide]);

  const backHref = selectedService
    ? `/service/${selectedService.slug}`
    : "/panel";

  return (
    <main
      dir="rtl"
      className="min-h-[100dvh] overflow-x-hidden bg-[#070b14] px-3 py-4 text-white sm:px-5"
    >
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
        >
          <ArrowRight size={16} /> بازگشت
        </Link>
        <section className="mt-4 rounded-[30px] border border-white/10 bg-white/[.035] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
              <ShoppingBag size={21} />
            </div>
            <div>
              <p className="text-xs text-white/40">خرید سرویس</p>
              <h1 className="mt-1 text-xl font-black">
                {selectedService?.title ?? "سرویس"}
              </h1>
            </div>
          </div>
          {!selectedProduct && (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">
              محصولی برای خرید انتخاب نشده است.
            </div>
          )}
          {selectedProduct && loading && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-white/10 p-8 text-sm text-white/45">
              <Loader2 className="animate-spin" size={17} /> در حال دریافت
              راهنما...
            </div>
          )}
          {selectedProduct && error && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}
          {selectedProduct && !loading && selectedService?.slug === "apple-id" && (
            <AppleServicePurchase
              service={selectedService}
              product={selectedProduct}
              guide={guide}
            />
          )}
          {selectedProduct && !loading && selectedService?.slug !== "apple-id" && (
            <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[.025] p-5">
              <h2 className="font-black">{selectedProduct.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-8 text-white/55">
                {selectedProduct.description}
              </p>
              <button className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950">
                شروع خرید
              </button>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
