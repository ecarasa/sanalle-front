import type { SemaforoStock } from '@/types'

const ESTILOS: Record<string, { clase: string; titulo: string }> = {
  rojo: { clase: 'bg-red-100 text-red-700', titulo: 'En o por debajo del mínimo' },
  amarillo: { clase: 'bg-amber-100 text-amber-700', titulo: 'Cerca del mínimo' },
  verde: { clase: 'bg-green-100 text-green-700', titulo: 'Por encima del mínimo' },
}

interface Props {
  /** Color que calcula el backend. null = el producto no tiene mínimo configurado. */
  semaforo: SemaforoStock
  /** Lo que se muestra dentro del badge (normalmente las cajas totales). */
  children: React.ReactNode
  /** Mínimo del producto, para el tooltip. */
  minimo?: number | null
}

/**
 * Badge de stock coloreado contra el mínimo del producto.
 *
 * Sin mínimo cargado no se pinta de ningún color: un gris neutro es honesto,
 * mientras que verde diría "está bien" sin tener con qué compararlo.
 */
export default function SemaforoStockBadge({ semaforo, children, minimo }: Props) {
  const estilo = semaforo ? ESTILOS[semaforo] : null
  const titulo = estilo
    ? `${estilo.titulo}${minimo ? ` (mín ${minimo})` : ''}`
    : 'Sin mínimo configurado'
  return (
    <span
      title={titulo}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        estilo ? estilo.clase : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  )
}
