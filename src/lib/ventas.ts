// Lógica pura del "formato de venta" (caja / blíster).
// Sin dependencias de React: testeable de forma aislada.

import type { Producto } from '@/types'

export type UnidadVenta = 'caja' | 'blister'

export const UNIDAD_LABEL: Record<UnidadVenta, string> = {
  caja: 'Caja / Expendedor',
  blister: 'Blíster',
}

/** Unidades de venta habilitadas para un producto (siempre al menos 'caja'). */
export function unidadesDeProducto(p: Pick<Producto, 'vende_caja' | 'vende_blister'>): UnidadVenta[] {
  const u: UnidadVenta[] = []
  if (p.vende_caja) u.push('caja')
  if (p.vende_blister) u.push('blister')
  return u.length > 0 ? u : ['caja']
}

/**
 * Precio base por unidad: el blíster deriva del precio de caja / blisters_por_caja.
 * Devuelve null si no hay precio de caja (nunca 0). Si es blíster pero no hay
 * blisters_por_caja válido, cae al precio de caja (no puede fraccionar).
 */
export function precioBasePorUnidad(
  precioCaja: number | null,
  unidad: UnidadVenta,
  blistersPorCaja: number | null,
): number | null {
  if (precioCaja === null) return null
  if (unidad === 'blister' && blistersPorCaja && blistersPorCaja > 0) {
    return precioCaja / blistersPorCaja
  }
  return precioCaja
}
