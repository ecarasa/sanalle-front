'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

/**
 * Solapa de Stock.
 *
 * Las pestañas son subrutas y no estado local porque cada una tiene sus propios
 * datos y filtros, y todas necesitan URL: se linkea a un inventario en curso
 * desde otro lado, y recargar no puede devolverte a la primera pestaña.
 */
const PESTANAS = [
  { href: '/dashboard/stock', label: 'Existencias', soloEscritura: false },
  { href: '/dashboard/stock/movimientos', label: 'Movimientos', soloEscritura: false },
  { href: '/dashboard/stock/cambios', label: 'Cambios', soloEscritura: false },
  { href: '/dashboard/stock/inventarios', label: 'Inventarios', soloEscritura: true },
  { href: '/dashboard/stock/importar', label: 'Carga masiva', soloEscritura: true },
]

export default function StockLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const puedeEscribir = user?.rol !== 'ventas'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-500 mt-1">
          {puedeEscribir
            ? 'Existencias, correcciones y recuentos físicos'
            : 'Consulta de existencias (solo lectura)'}
        </p>
      </div>

      <nav className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {PESTANAS.filter((p) => puedeEscribir || !p.soloEscritura).map((p) => {
          const activa = p.href === '/dashboard/stock'
            ? pathname === p.href
            : pathname.startsWith(p.href)
          return (
            <Link
              key={p.href}
              href={p.href}
              className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activa
                  ? 'border-[#003087] text-[#003087]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
