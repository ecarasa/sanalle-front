'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '@/lib/api'
import { CONFIG_DEFAULTS } from '@/lib/configuracion'

interface ConfiguracionContextValue {
  config: Record<string, string>
  isLoading: boolean
  /** Valor crudo de la clave (una clave inexistente usa su default del catálogo) */
  valor: (clave: string) => string
  /** Valor como número. Si no parsea, devuelve el default; si el default tampoco, 0. */
  numero: (clave: string) => number
  refresh: () => Promise<void>
}

const ConfiguracionContext = createContext<ConfiguracionContextValue>({
  config: {},
  isLoading: true,
  valor: (clave) => CONFIG_DEFAULTS[clave] ?? '',
  numero: () => 0,
  refresh: async () => {},
})

export function ConfiguracionProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<Record<string, string>>('/configuracion')
      setConfig(res.data ?? {})
    } catch {
      // Si falla la carga no bloqueamos la app: se usan los defaults del catálogo
      setConfig({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const valor = useCallback(
    (clave: string) => config[clave] ?? CONFIG_DEFAULTS[clave] ?? '',
    [config]
  )

  const numero = useCallback(
    (clave: string) => {
      const n = Number(valor(clave))
      if (Number.isFinite(n)) return n
      const fallback = Number(CONFIG_DEFAULTS[clave])
      return Number.isFinite(fallback) ? fallback : 0
    },
    [valor]
  )

  return (
    <ConfiguracionContext.Provider value={{ config, isLoading, valor, numero, refresh }}>
      {children}
    </ConfiguracionContext.Provider>
  )
}

export function useConfiguracion() {
  return useContext(ConfiguracionContext)
}
