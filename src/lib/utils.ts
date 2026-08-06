import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-'
  // Tomar solo la parte de fecha (soporta tanto "YYYY-MM-DD" como ISO datetime "YYYY-MM-DDTHH:mm:ss").
  // Replace dashes with slashes to force local time parsing and avoid 1-day offset
  const datePart = dateString.split('T')[0]
  const date = new Date(datePart.replace(/-/g, '/'))
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}


export function formatDateTime(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString.replace(/-/g, '/'))
  return date.toLocaleDateString('es-AR', {

    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
