"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { SmsOrderCardData } from "@/components/service/SmsOrderCard";

type SmsCodeContextValue = {
  get: (id: string) => Promise<SmsOrderCardData>;
  resend: (id: string) => Promise<SmsOrderCardData>;
  cancel: (id: string) => Promise<SmsOrderCardData>;
  active: (serviceId: string) => Promise<SmsOrderCardData | null>;
};

const SmsCodeContext = createContext<SmsCodeContextValue | null>(null);

export function SmsCodeProvider({ children }: { children: ReactNode }) {
  const get = useCallback((id: string) => api<SmsOrderCardData>(`smscode/orders/${id}`), []);
  const resend = useCallback(
    (id: string) => api<SmsOrderCardData>(`smscode/orders/${id}/resend`, { method: "POST" }),
    [],
  );
  const cancel = useCallback(
    (id: string) => api<SmsOrderCardData>(`smscode/orders/${id}/cancel`, { method: "POST" }),
    [],
  );
  const active = useCallback(
    (serviceId: string) => api<SmsOrderCardData | null>(`smscode/orders/active?serviceId=${encodeURIComponent(serviceId)}`),
    [],
  );

  const value = useMemo(() => ({ get, resend, cancel, active }), [get, resend, cancel, active]);
  return <SmsCodeContext.Provider value={value}>{children}</SmsCodeContext.Provider>;
}

export function useSmsCode() {
  const context = useContext(SmsCodeContext);
  if (!context) throw new Error("useSmsCode باید داخل SmsCodeProvider استفاده شود.");
  return context;
}
