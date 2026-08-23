'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, Service } from '@/components/panel/types';

type ServiceState = {
  selectedService: Service | null;
  selectedProduct: Product | null;
  setSelection: (service: Service, product?: Product | null) => void;
  clearSelection: () => void;
};

export const useServiceStore = create<ServiceState>()(
  persist(
    (set) => ({
      selectedService: null,
      selectedProduct: null,
      setSelection: (selectedService, selectedProduct = null) => set({ selectedService, selectedProduct }),
      clearSelection: () => set({ selectedService: null, selectedProduct: null }),
    }),
    {
      name: 'mini-app-service-selection',
      partialize: (state) => ({
        selectedService: state.selectedService,
        selectedProduct: state.selectedProduct,
      }),
    },
  ),
);
