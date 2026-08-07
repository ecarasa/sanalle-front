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

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Vitalnova'
  const appInitial = appName.charAt(0).toUpperCase()

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #001B5A 0%, #012A6E 55%, #003087 100%)' }}
    >
      {/* Glows decorativos */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#00AEEF] opacity-20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#E31837] opacity-10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Marca */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-lg shadow-black/30"
            style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
          >
            {appInitial}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{appName}</h1>
          <p className="mt-1 text-sm text-white/60">
            Droguería y Distribuidora de Medicamentos
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur sm:p-10">
          <h2 className="text-lg font-semibold text-gray-900">Iniciar sesión</h2>
          <p className="mt-1 mb-6 text-sm text-gray-500">
            Ingresá tus credenciales para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                  text-[#1A1A2E] placeholder-gray-400
                  focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25 focus:outline-none
                  disabled:bg-gray-50 disabled:cursor-not-allowed
                  transition-shadow"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                  text-[#1A1A2E] placeholder-gray-400
                  focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25 focus:outline-none
                  disabled:bg-gray-50 disabled:cursor-not-allowed
                  transition-shadow"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white
                shadow-lg shadow-[#00AEEF]/25
                transition-all hover:shadow-xl hover:brightness-105 active:scale-[0.99]
                focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 focus:ring-offset-2
                disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white"
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
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/40">
          Sistema de Gestión Empresarial
        </p>
      </div>
    </div>
  )
}
