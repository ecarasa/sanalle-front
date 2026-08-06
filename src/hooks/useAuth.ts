'use client'
import { useState, useEffect, useCallback } from 'react'
import { User } from '@/types'
import { login as authLogin, logout as authLogout, getStoredUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedUser = getStoredUser()
    setUser(storedUser)
    setIsLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const user = await authLogin(username, password)
      setUser(user)
      router.push('/dashboard')
      return user
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
    router.push('/login')
  }, [router])

  return { user, isLoading, login, logout }
}
