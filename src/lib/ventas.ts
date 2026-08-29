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

/**
 * Precio unitario y total de una línea, a partir del precio de lista y el
 * descuento. Es la única cuenta de plata de una línea: la usan tanto el modal
 * de alta como los inputs de la grilla, para que no puedan desincronizarse.
 *
 * `precioUnitario` se pasa cuando el vendedor lo pisó a mano; en ese caso manda
 * él y el descuento queda como referencia de dónde salió.
 */
export function recalcularLinea(l: {
  precioLista: number | null
  descuento: number | null
  precioUnitario?: number | null
  cantidad: number
}): { precioUnitario: number; precioTotal: number } {
  const unitario =
    l.precioUnitario != null && l.precioUnitario >= 0
      ? l.precioUnitario
      : (l.precioLista ?? 0) * (1 - (l.descuento ?? 0) / 100)

  const cantidad = Number.isFinite(l.cantidad) && l.cantidad > 0 ? l.cantidad : 0
  return { precioUnitario: unitario, precioTotal: unitario * cantidad }
}

/** Precio unitario que resulta de aplicar un descuento sobre el precio de lista. */
export function precioConDescuento(precioLista: number, descuento: number): number {
  return precioLista * (1 - (descuento || 0) / 100)
}
