'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

export default function UsuariosLayout({
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
      } else if (user.rol !== 'super_admin') {
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
