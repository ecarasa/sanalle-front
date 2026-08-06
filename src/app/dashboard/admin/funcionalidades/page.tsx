'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { FEATURES } from '@/lib/features'
import api from '@/lib/api'

const GRUPOS = ['General', 'Operaciones', 'Administración']

export default function FuncionalidadesPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { isEnabled, refresh, isLoading: flagsLoading } = useFeatureFlags()
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user && user.rol !== 'super_admin') {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading || !user || user.rol !== 'super_admin') return null

  const handleToggle = async (key: string, habilitado: boolean) => {
    setSaving(key)
    try {
      await api.put(`/feature-flags/${key}`, { habilitado })
      await refresh()
      toast.success(habilitado ? 'Módulo habilitado' : 'Módulo deshabilitado')
    } catch {
      toast.error('No se pudo actualizar el módulo')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <SlidersHorizontal className="text-[#003087]" size={22} />
        <h1 className="text-xl font-bold text-gray-900">Funcionalidades</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Habilitá o deshabilitá módulos de la aplicación. Los módulos deshabilitados se ocultan
        del menú y no se puede acceder a ellos, excepto para el rol Super Administrador, que
        siempre ve todo.
      </p>

      {flagsLoading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="space-y-6">
          {GRUPOS.map((grupo) => (
            <div key={grupo} className="bg-white rounded-lg shadow border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {grupo}
              </div>
              <div className="divide-y divide-gray-100">
                {FEATURES.filter((f) => f.grupo === grupo).map((f) => {
                  const enabled = isEnabled(f.key)
                  return (
                    <div key={f.key} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{f.label}</p>
                        <p className="text-xs text-gray-400">{f.descripcion ?? f.href}</p>
                      </div>
                      <button
                        onClick={() => handleToggle(f.key, !enabled)}
                        disabled={saving === f.key}
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`${enabled ? 'Deshabilitar' : 'Habilitar'} ${f.label}`}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                          enabled ? 'bg-[#00AEEF]' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
