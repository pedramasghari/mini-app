'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Me, Service, Product, Method, Notification } from '@/components/panel/types';

type C = { me: Me | null; services: Service[]; products: Product[]; methods: Method[]; notifications: Notification[]; loading: boolean; realtime: boolean; refresh: () => Promise<void>; markRead: (id: string) => Promise<void> };
const PanelContext = createContext<C | null>(null);

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtime, setRealtime] = useState(false);

  const refresh = useCallback(async () => {
    const [m, s, p, pm, n] = await Promise.all([
      api<Me>('auth/me'), api<Service[]>('services'), api<Product[]>('products'), api<Method[]>('payment-methods'), api<Notification[]>('notifications'),
    ]);
    setMe(m); setServices(s); setProducts(p); setMethods(pm); setNotifications(n);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().catch(console.error).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    let es: EventSource | undefined;
    let retryTimer: number | undefined;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      es = new EventSource('/api/notifications/stream');
      es.onopen = () => setRealtime(true);
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'notification' && payload.notification) {
            setNotifications((current) => [payload.notification, ...current.filter((item) => item.id !== payload.notification.id)].slice(0, 50));
          }
          if (payload.type === 'wallet.updated' && payload.wallet) {
            setMe((current) => current?.wallet ? { ...current, wallet: { ...current.wallet, balance: String(payload.wallet.balance), currency: payload.wallet.currency } } : current);
          }
        } catch { /* Ignore malformed events. */ }
      };
      es.onerror = () => {
        setRealtime(false);
        es?.close();
        if (!disposed) retryTimer = window.setTimeout(connect, 4000);
      };
    };
    connect();
    return () => { disposed = true; if (retryTimer) window.clearTimeout(retryTimer); es?.close(); setRealtime(false); };
  }, []);

  const markRead = useCallback(async (id: string) => {
    await api(`notifications/${id}/read`, { method: 'POST' });
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }, []);
  const value = useMemo(() => ({ me, services, products, methods, notifications, loading, realtime, refresh, markRead }), [me, services, products, methods, notifications, loading, realtime, refresh, markRead]);
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}
export function usePanel() { const context = useContext(PanelContext); if (!context) throw new Error('usePanel must be used inside PanelProvider'); return context; }
