// Espejo de backend/app/services/pricing_service.py — si agregás una lista allá,
// agregala acá. Todo lo que muestra o elige precios (catálogo, form de pedidos,
// grilla de productos, badges) se genera desde este registro.

export type Grupo = 'minorista' | 'mayorista' | 'comercio'

export type ListaKey = 'minorista' | 'mayorista' | 'comercio'

export type MargenField = 'margen_minorista' | 'margen_mayorista' | 'margen_comercio'

export type PrecioField = 'precio_venta_minorista' | 'precio_venta_mayorista' | 'precio_venta_comercio'

export interface ListaDef {
  key: ListaKey
  label: string
  short: string
  grupo: Grupo
  margenField: MargenField
  precioField: PrecioField
  colorClass: string
}

export const LISTAS: readonly ListaDef[] = [
  {
    key: 'minorista',
    label: 'Precio Minorista',
    short: 'Minorista',
    grupo: 'minorista',
    margenField: 'margen_minorista',
    precioField: 'precio_venta_minorista',
    colorClass: 'text-blue-700',
  },
  {
    key: 'mayorista',
    label: 'Precio Mayorista',
    short: 'Mayorista',
    grupo: 'mayorista',
    margenField: 'margen_mayorista',
    precioField: 'precio_venta_mayorista',
    colorClass: 'text-purple-700',
  },
  {
    key: 'comercio',
    label: 'Precio Comercio',
    short: 'Comercio',
    grupo: 'comercio',
    margenField: 'margen_comercio',
    precioField: 'precio_venta_comercio',
    colorClass: 'text-teal-700',
  },
] as const

export const LISTAS_BY_KEY: Record<ListaKey, ListaDef> = LISTAS.reduce(
  (acc, lista) => ({ ...acc, [lista.key]: lista }),
  {} as Record<ListaKey, ListaDef>
)

export const GRUPOS: readonly Grupo[] = ['minorista', 'mayorista', 'comercio']

/** Listas de un grupo. Cada grupo tiene exactamente una lista. */
export function listasDe(grupo: Grupo): ListaDef[] {
  return LISTAS.filter((lista) => lista.grupo === grupo)
}

/** La lista de un grupo (cada grupo tiene una sola). */
export function listaDe(grupo: Grupo): ListaDef | null {
  return LISTAS.find((lista) => lista.grupo === grupo) ?? null
}

export const GRUPO_LABEL: Record<Grupo, string> = {
  minorista: 'Minorista',
  mayorista: 'Mayorista',
  comercio: 'Comercio',
}

export const GRUPO_BADGE: Record<Grupo, string> = {
  minorista: 'bg-slate-100 text-slate-700',
  mayorista: 'bg-blue-100 text-blue-700',
  comercio: 'bg-teal-100 text-teal-700',
}

export const GRUPO_OPTIONS = GRUPOS.map((grupo) => ({
  value: grupo,
  label: GRUPO_LABEL[grupo],
}))

export function esGrupo(value: unknown): value is Grupo {
  return typeof value === 'string' && (GRUPOS as readonly string[]).includes(value)
}
