import { create } from 'zustand'

type ActiveTab = 'notes' | 'files' | 'recordings' | 'ai'

interface UIState {
  sidebarOpen: boolean
  activeTab: ActiveTab
  aiPanelOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActiveTab: (tab: ActiveTab) => void
  setAIPanelOpen: (open: boolean) => void
  toggleAIPanel: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTab: 'notes',
  aiPanelOpen: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setAIPanelOpen: (open) => set({ aiPanelOpen: open }),
  toggleAIPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
}))
