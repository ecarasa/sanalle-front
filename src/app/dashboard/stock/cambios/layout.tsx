'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

/**
 * La bitácora dice quién tocó qué producto y desde dónde: es dato de control
 * interno, no de operación. Se restringe a administración, igual que el maestro
 * de productos que audita (`ROLES_MAESTRO_PRODUCTOS` en el backend).
 */
const ROLES_PERMITIDOS = ['admin', 'super_admin']

export default function StockCambiosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login')
      } else if (!ROLES_PERMITIDOS.includes(user.rol)) {
        router.push('/dashboard')
      } else {
        setIsAuthorized(true)
      }
    }
  }, [user, isLoading, router])

  if (isLoading || !isAuthorized) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return <>{children}</>
}
