'use client'

import { useState, FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      toast.error('Ingrese usuario y contraseña')
      return
    }

    setIsSubmitting(true)
    try {
      await login(username, password)
      toast.success('Bienvenido al sistema')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error al iniciar sesión'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-10">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#003087]">
            {process.env.NEXT_PUBLIC_APP_NAME}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#E31837]">
            Droguería y Distribuidora de Medicamentos
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[#1A1A2E] mb-1.5"
            >
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ingrese su usuario"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                text-[#1A1A2E] placeholder-gray-400
                focus:border-[#003087] focus:ring-2 focus:ring-[#003087]/20 focus:outline-none
                disabled:bg-gray-50 disabled:cursor-not-allowed
                transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#1A1A2E] mb-1.5"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ingrese su contraseña"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                text-[#1A1A2E] placeholder-gray-400
                focus:border-[#003087] focus:ring-2 focus:ring-[#003087]/20 focus:outline-none
                disabled:bg-gray-50 disabled:cursor-not-allowed
                transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#003087] px-4 py-2.5 text-sm font-semibold text-white
              hover:bg-[#002470] active:bg-[#001a5c]
              focus:outline-none focus:ring-2 focus:ring-[#003087]/50 focus:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Ingresando...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-400">
          Sistema de Gestión Empresarial
        </p>
      </div>
    </div>
  )
}
