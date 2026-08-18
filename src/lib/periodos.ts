// Utilidades de filtro por período, compartidas por Pagos, Pagos a proveedor, etc.

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Traduce un período elegido a un rango { desde, hasta } (fechas 'YYYY-MM-DD', inclusive).
 * Soporta: todos | hoy | ayer | semana (últimos 7 días) | mes (últimos 30 días) |
 * anterior (más viejo que el último mes) | 'YYYY-MM' (un mes calendario puntual).
 */
export function rangoDePeriodo(periodo: string): { desde?: string; hasta?: string } {
  if (periodo === 'todos') return {}

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (periodo === 'hoy') return { desde: fechaLocal(hoy), hasta: fechaLocal(hoy) }

  if (periodo === 'ayer') {
    const d = new Date(hoy); d.setDate(d.getDate() - 1)
    return { desde: fechaLocal(d), hasta: fechaLocal(d) }
  }

  if (periodo === 'semana') {
    const d = new Date(hoy); d.setDate(d.getDate() - 6)
    return { desde: fechaLocal(d), hasta: fechaLocal(hoy) }
  }

  if (periodo === 'mes') {
    const d = new Date(hoy); d.setDate(d.getDate() - 29)
    return { desde: fechaLocal(d), hasta: fechaLocal(hoy) }
  }

  if (periodo === 'anterior') {
    // Todo lo más viejo que la ventana "último mes" (30+ días atrás).
    const d = new Date(hoy); d.setDate(d.getDate() - 30)
    return { hasta: fechaLocal(d) }
  }

  const m = /^(\d{4})-(\d{2})$/.exec(periodo)
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2])
    return { desde: fechaLocal(new Date(y, mo - 1, 1)), hasta: fechaLocal(new Date(y, mo, 0)) }
  }

  return {}
}

/** Opciones "mes a mes" recientes, ej. { value: '2026-08', label: 'Agosto 2026' }. */
export function mesesRecientes(n = 18): { value: string; label: string }[] {
  const arr: { value: string; label: string }[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < n; i++) {
    arr.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`,
    })
    d.setMonth(d.getMonth() - 1)
  }
  return arr
}
