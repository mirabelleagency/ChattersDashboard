import { createContext, useContext, ReactNode } from 'react'
import { useSharedData, Chatter, ChatterPerformance } from '../hooks/useSharedData'

interface SharedDataContextType {
  chatters: Chatter[]
  performanceData: ChatterPerformance[]
  loading: boolean
  error: string
  loadChatters: () => Promise<void>
  updatePerformance: (chatter: string, updates: Partial<ChatterPerformance>) => void
  updateChatter: (chatterId: number, payload: any) => Promise<Chatter>
  deleteChatter: (chatterId: number, opts?: { soft?: boolean }) => Promise<void>
  setPerformanceData: React.Dispatch<React.SetStateAction<ChatterPerformance[]>>
}

const SharedDataContext = createContext<SharedDataContextType | undefined>(undefined)

export function SharedDataProvider({ children }: { children: ReactNode }) {
  const data = useSharedData()

  return (
    <SharedDataContext.Provider value={data}>
      {children}
    </SharedDataContext.Provider>
  )
}

export function useSharedDataContext() {
  const context = useContext(SharedDataContext)
  if (!context) {
    throw new Error('useSharedDataContext must be used within SharedDataProvider')
  }
  return context
}
