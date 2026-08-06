'use client'

import { useAuth } from '@/hooks/useAuth'

interface RoleGuardProps {
  children: React.ReactNode
  roles?: string[]
  fallback?: React.ReactNode
}

export default function RoleGuard({ children, roles, fallback }: RoleGuardProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) return null

  if (roles && !roles.includes(user.rol)) {
    return (
      fallback || (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No tiene permisos para ver esta secci&oacute;n
        </div>
      )
    )
  }

  return <>{children}</>
}
