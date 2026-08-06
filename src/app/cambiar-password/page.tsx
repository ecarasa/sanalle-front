'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error('Complete todos los campos')
      return
    }

    if (newPassword.length < 6) {
      toast.error('La nueva contrasena debe tener al menos 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contrasenas no coinciden')
      return
    }

    setSaving(true)
    try {
      await api.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('Contrasena actualizada correctamente')

      // Update user in localStorage to reflect password change
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          user.debe_cambiar_contrasena = false
          localStorage.setItem('user', JSON.stringify(user))
        } catch { /* ignore */ }
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al cambiar contrasena')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#003087]">
            {process.env.NEXT_PUBLIC_APP_NAME}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#E31837]">
            Droguería y Distribuidora de Medicamentos
          </p>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-[#003087]/10">
            <Lock className="w-8 h-8 text-[#003087]" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">Cambiar Contrasena</h2>
          <p className="text-sm text-gray-500 mt-1">
            Debe cambiar su contrasena para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-[#1A1A2E] mb-1.5"
            >
              Contrasena Actual
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              placeholder="Ingrese su contrasena actual"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                text-[#1A1A2E] placeholder-gray-400
                focus:border-[#003087] focus:ring-2 focus:ring-[#003087]/20 focus:outline-none
                disabled:bg-gray-50 disabled:cursor-not-allowed
                transition-colors"
              required
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-[#1A1A2E] mb-1.5"
            >
              Nueva Contrasena
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              placeholder="Ingrese su nueva contrasena"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                text-[#1A1A2E] placeholder-gray-400
                focus:border-[#003087] focus:ring-2 focus:ring-[#003087]/20 focus:outline-none
                disabled:bg-gray-50 disabled:cursor-not-allowed
                transition-colors"
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-[#1A1A2E] mb-1.5"
            >
              Confirmar Contrasena
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              placeholder="Repita la nueva contrasena"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                text-[#1A1A2E] placeholder-gray-400
                focus:border-[#003087] focus:ring-2 focus:ring-[#003087]/20 focus:outline-none
                disabled:bg-gray-50 disabled:cursor-not-allowed
                transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-[#003087] px-4 py-2.5 text-sm font-semibold text-white
              hover:bg-[#002470] active:bg-[#001a5c]
              focus:outline-none focus:ring-2 focus:ring-[#003087]/50 focus:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              'Cambiar Contrasena'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400">
          Sistema de Gestion Empresarial
        </p>
      </div>
    </div>
  )
}
