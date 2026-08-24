import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TabType = 'home' | 'deposit' | 'withdraw' | 'transactions';

interface AppState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'home',
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: 'miniapp-panel-state',
      partialize: (state) => ({ activeTab: state.activeTab }),
    },
  ),
);
