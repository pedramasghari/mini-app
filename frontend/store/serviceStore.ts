'use client';

import { create } from 'zustand';
import type { Product, Service } from '@/components/panel/types';

type ServiceState = {
  selectedService: Service | null;
  selectedProduct: Product | null;
  setSelection: (service: Service, product?: Product | null) => void;
  clearSelection: () => void;
};

export const useServiceStore = create<ServiceState>((set) => ({
  selectedService: null,
  selectedProduct: null,
  setSelection: (selectedService, selectedProduct = null) => set({ selectedService, selectedProduct }),
  clearSelection: () => set({ selectedService: null, selectedProduct: null }),
}));
