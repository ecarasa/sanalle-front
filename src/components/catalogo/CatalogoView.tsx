'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { Package, ShoppingBag, Search, Inbox, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { ProductoPublico, PaginatedResponse } from '@/types'
import { Grupo, GRUPO_LABEL, ListaDef, listasDe } from '@/lib/listas'

const SIN_LABORATORIO = 'Sin laboratorio'
const SIN_LABORATORIO_ID = '__sin__'
const TODOS = ''

interface Props {
  grupo: Grupo
}

function DisponibleBadge({ stock }: { stock: number }) {
  if (stock > 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Disponible
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      Sin Stock
    </span>
  )
}

/** Guion largo: el producto no se vende en esa lista. NUNCA $0. */
function SinPrecio() {
  return <span className="text-gray-300 text-sm font-medium">—</span>
}

function PriceBreakdown({
  precioCaja,
  blistersPorCaja,
  comprimidosPorBlister,
  colorClass,
  compacto = false,
}: {
  precioCaja: number | null
  blistersPorCaja: number | null
  comprimidosPorBlister: number | null
  colorClass: string
  /** Variante angosta: sólo caja (destacado) + blister chiquito. Para las 3 columnas de comercio. */
  compacto?: boolean
}) {
  if (precioCaja == null) {
    return (
      <div className="text-right">
        <SinPrecio />
      </div>
    )
  }

  const precioBlister =
    blistersPorCaja && blistersPorCaja > 0 ? precioCaja / blistersPorCaja : null
  const precioComprimido =
    precioBlister && comprimidosPorBlister && comprimidosPorBlister > 0
      ? precioBlister / comprimidosPorBlister
      : null

  if (compacto) {
    return (
      <div className="flex flex-col gap-0.5 text-right whitespace-nowrap">
        <span className={`font-bold text-sm ${colorClass}`}>{formatCurrency(precioCaja)}</span>
        {precioBlister != null && (
          <span className="text-[11px] text-gray-500">
            {formatCurrency(precioBlister)}
            <span className="text-[10px] text-gray-400 ml-1">/ blister</span>
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 text-right">
      <span className={`font-bold text-base ${colorClass}`}>
        {formatCurrency(precioCaja)}
        <span className="text-[10px] font-normal text-gray-400 ml-1">/ caja</span>
      </span>
      {precioBlister != null && (
        <span className="text-xs text-gray-600">
          {formatCurrency(precioBlister)}
          <span className="text-[10px] text-gray-400 ml-1">/ blister</span>
        </span>
      )}
      {precioComprimido != null && (
        <span className="text-xs text-gray-500">
          {formatCurrency(precioComprimido)}
          <span className="text-[10px] text-gray-400 ml-1">/ comp.</span>
        </span>
      )}
    </div>
  )
}

interface LabGroup {
  id: string
  laboratorio: string
  productos: ProductoPublico[]
}

interface LabOption {
  id: string
  nombre: string
}

function labIdDe(producto: ProductoPublico): string {
  return producto.laboratorio_id != null ? String(producto.laboratorio_id) : SIN_LABORATORIO_ID
}

function labNombreDe(producto: ProductoPublico): string {
  return producto.laboratorio_nombre || SIN_LABORATORIO
}

export default function CatalogoView({ grupo }: Props) {
  const [search, setSearch] = useState('')
  const [laboratorioId, setLaboratorioId] = useState<string>(TODOS)
  const [data, setData] = useState<ProductoPublico[]>([])
  const [loading, setLoading] = useState(true)

  const debouncedSearch = useDebounce(search, 400)

  const listas: ListaDef[] = useMemo(() => listasDe(grupo), [grupo])
  const esComercio = grupo === 'comercio'
  const modeLabel = `Lista de Precios ${GRUPO_LABEL[grupo]}`
  const totalColumnas = 4 + listas.length

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = {
        search: debouncedSearch,
        all: true,
        lista: grupo,
      }
      const res = await api.get<PaginatedResponse<ProductoPublico>>('/productos/public', { params })
      setData(res.data.items)
    } catch (error) {
      console.error(error)
      toast.error('Error al cargar el catálogo')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, grupo])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  // Opciones del select: SIEMPRE derivadas del dataset COMPLETO (sin aplicar el filtro
  // de laboratorio), si no el select se quedaría con una sola opción al filtrar.
  const laboratorios = useMemo<LabOption[]>(() => {
    const map = new Map<string, string>()
    for (const p of data) {
      map.set(labIdDe(p), labNombreDe(p))
    }
    const opciones = Array.from(map, ([id, nombre]) => ({ id, nombre }))
    opciones.sort((a, b) => {
      // "Sin laboratorio" siempre al final, igual que el orden del backend.
      if (a.id === SIN_LABORATORIO_ID) return 1
      if (b.id === SIN_LABORATORIO_ID) return -1
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    })
    return opciones
  }, [data])

  // Si el laboratorio elegido desaparece del dataset (p. ej. al cambiar la búsqueda),
  // volvemos a "Todos" para no dejar el select en un valor fantasma.
  useEffect(() => {
    if (loading || !laboratorioId) return
    if (!laboratorios.some((lab) => lab.id === laboratorioId)) setLaboratorioId(TODOS)
  }, [laboratorios, laboratorioId, loading])

  // Filtro en cliente: instantáneo y sin flicker (ya tenemos todo el catálogo con all=true).
  const visibles = useMemo<ProductoPublico[]>(() => {
    if (!laboratorioId) return data
    return data.filter((p) => labIdDe(p) === laboratorioId)
  }, [data, laboratorioId])

  // El backend ya devuelve los productos ordenados por laboratorio y luego por nombre.
  // Acá solo los agrupamos en secciones, preservando ese orden.
  // Se agrupa por id de laboratorio, no por corridas consecutivas de nombre: así un
  // producto suelto fuera de orden, o dos laboratorios que se llamen igual, no parten
  // la tabla en dos cabeceras iguales. El orden de las secciones lo sigue dando el
  // backend (viene ordenado por laboratorio), respetando el primero que aparece.
  const grupos = useMemo<LabGroup[]>(() => {
    const porLab = new Map<string, LabGroup>()
    for (const p of visibles) {
      const id = labIdDe(p)
      let grupo = porLab.get(id)
      if (!grupo) {
        grupo = { id, laboratorio: labNombreDe(p), productos: [] }
        porLab.set(id, grupo)
      }
      grupo.productos.push(p)
    }
    return Array.from(porLab.values())
  }, [visibles])

  const totalVisible = visibles.length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                  SANALLE
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium tracking-wider uppercase">
                  {modeLabel}
                </p>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-900">Consulta de Precios</p>
              <p className="text-xs text-gray-500">Actualizado en tiempo real</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {modeLabel}
          </h2>
          <p className="mt-2 text-lg text-gray-600">
            {esComercio
              ? 'Explore nuestro inventario actualizado con precios por formato: blisteado, estuchado y hospitalario.'
              : 'Explore nuestro inventario actualizado con precios por caja, blister y comprimido.'}
          </p>
        </div>

        {/* Buscador + filtro por laboratorio */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o categoría..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
          </div>

          <div className="relative w-full sm:w-64">
            <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <select
              value={laboratorioId}
              onChange={(e) => setLaboratorioId(e.target.value)}
              aria-label="Filtrar por laboratorio"
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 rounded-xl bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            >
              <option value={TODOS}>Todos los laboratorios</option>
              {laboratorios.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.nombre}
                </option>
              ))}
            </select>
          </div>

          {!loading && (
            <span className="text-sm text-gray-500">
              {totalVisible} producto{totalVisible === 1 ? '' : 's'} · {grupos.length} laboratorio{grupos.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Categoría</th>
                  <th className="px-4 py-3 hidden md:table-cell">Presentación</th>
                  <th className="px-4 py-3">Stock</th>
                  {listas.map((lista) => (
                    <th key={lista.key} className="px-4 py-3 text-right whitespace-nowrap">
                      {lista.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: totalColumnas }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + ((i + j) % 4) * 12}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : grupos.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumnas} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Inbox className="w-10 h-10" />
                        <p className="text-sm font-medium">No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  grupos.map((grupoLab) => (
                    <Fragment key={grupoLab.id}>
                      {/* Cabecera de laboratorio */}
                      <tr>
                        <th
                          colSpan={totalColumnas}
                          scope="colgroup"
                          className="sticky top-0 z-10 bg-[#003087] text-white text-left px-4 py-2.5 text-sm font-bold uppercase tracking-wide"
                        >
                          {grupoLab.laboratorio}
                          <span className="ml-2 font-normal normal-case text-white/70 text-xs">
                            ({grupoLab.productos.length})
                          </span>
                        </th>
                      </tr>
                      {grupoLab.productos.map((row) => (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              {row.foto_url ? (
                                <img src={row.foto_url} alt={row.nombre} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                                  <Package className="w-5 h-5 text-gray-300" />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-gray-900">{row.nombre}</span>
                                <span className="text-xs text-gray-500 font-mono">{row.codigo}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                              {row.categoria_producto || 'General'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            {(() => {
                              const parts: string[] = []
                              if (row.blisters_por_caja) parts.push(`${row.blisters_por_caja} blisters/caja`)
                              if (row.comprimidos_por_blister) parts.push(`${row.comprimidos_por_blister} comp./blister`)
                              return parts.length > 0 ? (
                                <div className="flex flex-col text-xs text-gray-600">
                                  {parts.map((p, i) => <span key={i}>{p}</span>)}
                                </div>
                              ) : <span className="text-gray-400 text-xs">{row.presentacion || '-'}</span>
                            })()}
                          </td>
                          <td className="px-4 py-2.5">
                            <DisponibleBadge stock={(row.stock_a_cajas || 0) + (row.stock_b_cajas || 0)} />
                          </td>
                          {listas.map((lista) => (
                            <td key={lista.key} className="px-4 py-2.5">
                              <PriceBreakdown
                                precioCaja={row.precios?.[lista.key] ?? null}
                                blistersPorCaja={row.blisters_por_caja ?? null}
                                comprimidosPorBlister={row.comprimidos_por_blister ?? null}
                                colorClass={lista.colorClass}
                                compacto={esComercio}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="mt-12 py-8 border-t border-gray-200 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} SANALLE - Droguería y Distribuidora de Medicamentos. Todos los derechos reservados.
          </p>
        </footer>
      </main>

      <style jsx global>{`
        :root { --primary: #003087; }
      `}</style>
    </div>
  )
}
