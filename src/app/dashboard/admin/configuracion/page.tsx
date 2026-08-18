'use client'

import { useState, useEffect } from 'react'
import { Settings, Loader2, Save, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface Config {
  producto_nuevo_dias: string
  [k: string]: string
}

export default function ConfiguracionGeneralPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<Config>('/configuracion')
      .then((res) => setConfig(res.data))
      .catch(() => toast.error('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  const guardar = async () => {
    if (!config) return
    const dias = parseInt(config.producto_nuevo_dias, 10)
    if (isNaN(dias) || dias < 1 || dias > 365) {
      toast.error('Los días de "producto nuevo" deben estar entre 1 y 365')
      return
    }
    setSaving(true)
    try {
      const res = await api.put<Config>('/configuracion', {
        producto_nuevo_dias: String(dias),
      })
      setConfig(res.data)
      toast.success('Configuración guardada')
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#003087] rounded-lg">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración general</h1>
          <p className="text-sm text-gray-500">Parámetros del sistema.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#003087]" />
        </div>
      ) : config ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {/* Producto nuevo: días */}
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#00AEEF]/10 text-[#0086c3] mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-900">Productos nuevos</h2>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">
                  Un producto se marca como <span className="font-semibold">NUEVO</span> (badge y filtro) si se cargó
                  dentro de esta cantidad de días.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={config.producto_nuevo_dias}
                    onChange={(e) => setConfig({ ...config, producto_nuevo_dias: e.target.value })}
                    className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                  <span className="text-sm text-gray-500">días</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 flex justify-end">
            <button
              type="button"
              onClick={guardar}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
