'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '@/lib/api'
import { FEATURE_DEFAULTS } from '@/lib/features'

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>
  isLoading: boolean
  /** true si el módulo está habilitado (un flag inexistente usa su default del catálogo) */
  isEnabled: (key: string | undefined) => boolean
  refresh: () => Promise<void>
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  isLoading: true,
  isEnabled: () => true,
  refresh: async () => {},
})

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/feature-flags')
      const map: Record<string, boolean> = {}
      for (const f of res.data as { clave: string; habilitado: boolean }[]) {
        map[f.clave] = f.habilitado
      }
      setFlags(map)
    } catch {
      // Si falla la carga no bloqueamos la app: todo queda habilitado
      setFlags({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isEnabled = useCallback(
    (key: string | undefined) => (key ? flags[key] ?? FEATURE_DEFAULTS[key] ?? true : true),
    [flags]
  )

  return (
    <FeatureFlagsContext.Provider value={{ flags, isLoading, isEnabled, refresh }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext)
}
