/**
 * UI Store
 * Global UI state management
 */
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'hesabyar:theme';
const WIZARD_KEY = 'hesabyar:wizard:done';

function loadTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

function loadWizardDone(): boolean {
  try {
    return window.localStorage.getItem(WIZARD_KEY) === '1';
  } catch {
    return false;
  }
}

interface UIState {
  sidebarOpen: boolean;
  theme: ThemeMode;
  currentPage: string;
  wizardDone: boolean;
  showWizard: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setCurrentPage: (page: string) => void;
  completeWizard: () => void;
  openWizard: () => void;
  closeWizard: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  theme: loadTheme(),
  currentPage: 'dashboard',
  wizardDone: loadWizardDone(),
  showWizard: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
    set({ theme: next });
  },
  setCurrentPage: (page) => set({ currentPage: page }),
  completeWizard: () => {
    try {
      window.localStorage.setItem(WIZARD_KEY, '1');
    } catch {
      // ignore
    }
    set({ wizardDone: true, showWizard: false });
  },
  openWizard: () => set({ showWizard: true }),
  closeWizard: () => set({ showWizard: false }),
}));
