// Espejo de backend/app/services/pricing_service.py. El backend es la fuente de
// verdad: recalcula siempre al guardar. Esto es sólo para mostrar el precio en vivo
// mientras el usuario tipea en el formulario.

import { LISTAS, ListaKey, MargenField } from '@/lib/listas'

export const IIBB_FACTOR = 1.03

/**
 * '' -> null (NO 0). Es la regla que sostiene toda la lista comercio: un margen
 * vacío significa "el producto no se vende en esta lista", y su precio queda en
 * null. Con `parseFloat(x) || 0`, un margen vacío se volvería 0% y le inventaría
 * un precio a todos los productos.
 */
export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function calcularCostos(
  pvp: number | null,
  costoPorcentaje: number | null
): { costoNeto: number | null; costoMasIibb: number | null } {
  if (pvp === null || costoPorcentaje === null) {
    return { costoNeto: null, costoMasIibb: null }
  }
  const costoNeto = pvp * (1 - costoPorcentaje / 100)
  return { costoNeto, costoMasIibb: costoNeto * IIBB_FACTOR }
}

export function calcularPrecio(costoMasIibb: number | null, margen: number | null): number | null {
  if (costoMasIibb === null || margen === null) return null
  return costoMasIibb * (1 + margen / 100)
}

export function recalcularPrecios(
  pvp: number | null,
  costoPorcentaje: number | null,
  margenes: Partial<Record<MargenField, number | null>>
): {
  costoNeto: number | null
  costoMasIibb: number | null
  precios: Record<ListaKey, number | null>
} {
  const { costoNeto, costoMasIibb } = calcularCostos(pvp, costoPorcentaje)

  const precios = LISTAS.reduce((acc, lista) => {
    acc[lista.key] = calcularPrecio(costoMasIibb, margenes[lista.margenField] ?? null)
    return acc
  }, {} as Record<ListaKey, number | null>)

  return { costoNeto, costoMasIibb, precios }
}

/** Formatea un número a string con 2 decimales, o '' si es null (para inputs). */
export function toInput(value: number | null): string {
  return value === null ? '' : value.toFixed(2)
}

/**
 * Márgenes por defecto al crear un producto. Las listas de comercio arrancan
 * VACÍAS a propósito: son opt-in por producto (sin margen no se publica precio).
 */
export const CATEGORY_MARGINS: Record<string, Partial<Record<MargenField, string>>> = {
  OTC: { margen_minorista: '22', margen_mayorista: '14' },
  GENERICO: { margen_minorista: '30', margen_mayorista: '17' },
}
