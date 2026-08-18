// Filtrado y orden de productos en memoria (grilla client-side).
// Lógica pura, sin React: testeable de forma aislada.

import type { Producto } from '@/types'

export interface ProductoFiltroCriterios {
  /** Búsqueda global sobre nombre + código + categoría. */
  search: string
  /** id de proveedor como string ('' = todos). */
  proveedorId: string
  /** id de laboratorio como string ('' = todos). */
  laboratorioId: string
  /** Solo productos cargados en los últimos `productoNuevoDias` días. */
  soloNuevos: boolean
  /** Solo productos sin PVP. */
  sinPvp: boolean
  /** Días para considerar un producto "nuevo". */
  productoNuevoDias: number
  /** Filtros por columna { key: valor } (contains, case-insensitive). */
  columnFilters: Record<string, string>
  /** Timestamp de referencia (inyectable para tests). Default: Date.now(). */
  ahora?: number
}

const MS_DIA = 86400000

export function filtrarProductos(productos: Producto[], c: ProductoFiltroCriterios): Producto[] {
  const q = c.search.trim().toLowerCase()
  const provId = c.proveedorId ? Number(c.proveedorId) : null
  const labId = c.laboratorioId ? Number(c.laboratorioId) : null
  const ahora = c.ahora ?? Date.now()
  const nuevoLimite = ahora - c.productoNuevoDias * MS_DIA
  const cf = Object.entries(c.columnFilters)

  return productos.filter((p) => {
    if (provId !== null && p.proveedor_id !== provId) return false
    if (labId !== null && p.laboratorio_id !== labId) return false
    if (c.soloNuevos && !(p.created_at && new Date(p.created_at).getTime() >= nuevoLimite)) return false
    if (c.sinPvp && p.pvp != null) return false
    if (q) {
      const hay = `${p.nombre ?? ''} ${p.codigo ?? ''} ${p.categoria_producto ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    for (const [key, value] of cf) {
      if (!value) continue
      const cell = (p as unknown as Record<string, unknown>)[key]
      if (cell == null) return false
      if (!String(cell).toLowerCase().includes(String(value).toLowerCase())) return false
    }
    return true
  })
}

export function ordenarProductos(
  productos: Producto[],
  sortBy: string,
  sortDir: 'asc' | 'desc',
): Producto[] {
  const arr = [...productos]
  const dir = sortDir === 'desc' ? -1 : 1
  arr.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortBy]
    const bv = (b as unknown as Record<string, unknown>)[sortBy]
    if (av == null && bv == null) return 0
    if (av == null) return 1 // nulls al final
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), 'es', { numeric: true }) * dir
  })
  return arr
}
