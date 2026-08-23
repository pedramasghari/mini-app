import { create } from 'zustand';

export type TabType = 'home'  | 'deposit' | 'withdraw' |'transactions' ;

interface AppState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'home', // تب پیش‌فرض
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
