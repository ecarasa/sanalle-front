'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/layout/Sidebar'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { FeatureFlagsProvider, useFeatureFlags } from '@/hooks/useFeatureFlags'
import { ConfiguracionProvider } from '@/hooks/useConfiguracion'
import { featureKeyForPath } from '@/lib/features'

/** Bloquea el acceso directo por URL a módulos deshabilitados (super_admin ve todo) */
function FeatureGuard({ rol, children }: { rol: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const { isEnabled, isLoading } = useFeatureFlags()

  if (rol === 'super_admin' || isLoading) return <>{children}</>

  const key = featureKeyForPath(pathname)
  if (key && !isEnabled(key)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-gray-700">Módulo no disponible</p>
        <p className="mt-2 text-sm text-gray-500">
          Esta sección está deshabilitada por el momento.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    )
  }
  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [isLoading, user, router])

  const handleChangePassword = useCallback(async () => {
    if (passwordForm.new_password !== passwordForm.confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setChangingPassword(true)
    try {
      await api.put('/users/me/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      toast.success('Contraseña actualizada correctamente')
      setShowPasswordModal(false)
      setPasswordForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al cambiar contraseña')
    } finally {
      setChangingPassword(false)
    }
  }, [passwordForm])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <FeatureFlagsProvider>
    <ConfiguracionProvider>
    <div className="min-h-screen bg-surface">
      <Sidebar
        user={{ nombre_completo: user.nombre_completo, rol: user.rol }}
        onLogout={logout}
        onChangePassword={() => setShowPasswordModal(true)}
      />

      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-3 sm:p-6">
          <FeatureGuard rol={user.rol}>{children}</FeatureGuard>
        </div>
      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            role="dialog"
            aria-labelledby="password-modal-title"
          >
            <h2 id="password-modal-title" className="text-lg font-semibold mb-4 text-text">
              Cambiar Contraseña
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña actual
                </label>
                <input
                  id="current-password"
                  type="password"
                  placeholder="Ingrese su contraseña actual"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="Ingrese la nueva contraseña"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme la nueva contraseña"
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ current_password: '', new_password: '', confirm: '' })
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {changingPassword ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ConfiguracionProvider>
    </FeatureFlagsProvider>
  )
}
