import api from './api'
import { Token, User } from '@/types'

export async function login(username: string, password: string): Promise<User> {
  const response = await api.post<Token & { debe_cambiar_contrasena?: boolean }>('/auth/login', { username, password })
  const { access_token, refresh_token, debe_cambiar_contrasena } = response.data
  localStorage.setItem('access_token', access_token)
  localStorage.setItem('refresh_token', refresh_token)

  const userResponse = await api.get<User>('/auth/me')
  localStorage.setItem('user', JSON.stringify(userResponse.data))

  if (debe_cambiar_contrasena === true) {
    window.location.href = '/cambiar-password'
  }

  return userResponse.data
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const user = localStorage.getItem('user')
  return user ? JSON.parse(user) : null
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('access_token')
}
