'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Package,
  ArrowRight,
  Info,
  ChevronDown,
  ArrowUpNarrowWide,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

interface HistorialPvpRow {
  id: number
  fecha_cambio: string
  pvp_anterior: number | null
  pvp_nuevo: number
  variacion_porcentaje: number | null
}

interface HistorialPvpResponse {
  producto_id: number
  producto_nombre: string
  producto_codigo: string
  historial: HistorialPvpRow[]
}

interface AumentoProducto {
  producto_id: number
  producto_nombre: string
  producto_codigo: string
  pvp_anterior: number
  pvp_nuevo: number
  variacion_porcentaje: number
}

interface AumentoGrupo {
  fecha: string
  cantidad_productos: number
  variacion_promedio: number
  variacion_promedio_aumentos: number
  variacion_min: number
  variacion_max: number
  productos: AumentoProducto[]
}

export default function HistorialPvpPage() {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<HistorialPvpResponse[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const [aumentos, setAumentos] = useState<AumentoGrupo[]>([])
  const [loadingAumentos, setLoadingAumentos] = useState(true)
  const [expandedFecha, setExpandedFecha] = useState<string | null>(null)

  useEffect(() => {
    api.get<AumentoGrupo[]>('/reportes/aumentos', { params: { dias: 365, limit: 30 } })
      .then((res) => setAumentos(res.data))
      .catch(() => setAumentos([]))
      .finally(() => setLoadingAumentos(false))
  }, [])

  const fetchData = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 3) {
      setResults([])
      return
    }
    
    setLoading(true)
    try {
      const res = await api.get<HistorialPvpResponse[]>('/reportes/historial-pvp', {
        params: { search: searchTerm },
      })
      setResults(res.data)
      setHasSearched(true)
    } catch (error) {
      console.error('Error fetching pvp history:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) fetchData(search)
    }, 500)
    return () => clearTimeout(timer)
  }, [search, fetchData])

  const getVariationIcon = (variation: number | null) => {
    if (variation === null || variation === 0) return <Minus className="w-4 h-4 text-gray-400" />
    if (variation > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />
    return <TrendingDown className="w-4 h-4 text-rose-500" />
  }

  const getVariationColor = (variation: number | null) => {
    if (variation === null || variation === 0) return 'text-gray-500 bg-gray-100'
    if (variation > 0) return 'text-emerald-700 bg-emerald-50'
    return 'text-rose-700 bg-rose-50'
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#003087] rounded-lg">
              <History className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Historial de Precios (PVP)</h1>
          </div>
          <p className="text-gray-500 mt-2">
            Seguimiento de cambios en el Precio de Venta al Público por producto
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative group w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#003087]">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#003087]" /> : <Search className="w-5 h-5 text-gray-400" />}
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-all shadow-sm"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Cuadro discriminado de Aumentos (por lote/día) */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <ArrowUpNarrowWide className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Aumentos de PVP</h2>
              <p className="text-xs text-gray-500">Cambios de precio agrupados por fecha, con % y productos afectados</p>
            </div>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Último año</span>
        </div>

        {loadingAumentos ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#003087]" />
          </div>
        ) : aumentos.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Info className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No se registraron aumentos de PVP en el período.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {aumentos.map((grupo) => (
              <div key={grupo.fecha}>
                <button
                  type="button"
                  onClick={() => setExpandedFecha(expandedFecha === grupo.fecha ? null : grupo.fecha)}
                  className={`w-full grid grid-cols-12 gap-4 items-center px-8 py-5 text-left transition-colors hover:bg-emerald-50/30 ${expandedFecha === grupo.fecha ? 'bg-emerald-50/40' : ''}`}
                >
                  <div className="col-span-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedFecha === grupo.fecha ? 'bg-emerald-600 text-white rotate-180' : 'bg-gray-100 text-gray-400'}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="col-span-4">
                    <p className="text-sm font-bold text-gray-900">{formatDate(grupo.fecha)}</p>
                    <p className="text-xs text-gray-400">{grupo.cantidad_productos} producto{grupo.cantidad_productos !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="col-span-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Prom. aumento</p>
                    <p className="text-lg font-black text-emerald-600">
                      {grupo.variacion_promedio_aumentos > 0 ? '+' : ''}{grupo.variacion_promedio_aumentos.toFixed(2)}%
                    </p>
                  </div>
                  <div className="col-span-4 text-right">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Rango</p>
                    <p className="text-sm font-bold text-gray-700">
                      {grupo.variacion_min > 0 ? '+' : ''}{grupo.variacion_min.toFixed(1)}% … {grupo.variacion_max > 0 ? '+' : ''}{grupo.variacion_max.toFixed(1)}%
                    </p>
                  </div>
                </button>

                {expandedFecha === grupo.fecha && (
                  <div className="bg-gray-50/60 px-8 py-4">
                    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                            <th className="px-6 py-3 text-left">Producto</th>
                            <th className="px-6 py-3 text-right">PVP Anterior</th>
                            <th className="px-6 py-3 text-right">Nuevo PVP</th>
                            <th className="px-6 py-3 text-right">Variación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {grupo.productos.map((p) => (
                            <tr key={p.producto_id} className="hover:bg-emerald-50/20 transition-colors">
                              <td className="px-6 py-3">
                                <p className="font-medium text-gray-800">{p.producto_nombre}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{p.producto_codigo}</p>
                              </td>
                              <td className="px-6 py-3 text-right text-gray-500">{formatCurrency(p.pvp_anterior)}</td>
                              <td className="px-6 py-3 text-right font-bold text-gray-900">{formatCurrency(p.pvp_nuevo)}</td>
                              <td className="px-6 py-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs ${getVariationColor(p.variacion_porcentaje)}`}>
                                  {getVariationIcon(p.variacion_porcentaje)}
                                  {p.variacion_porcentaje > 0 ? '+' : ''}{p.variacion_porcentaje.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="space-y-6">
        {!loading && results.length === 0 && hasSearched && search.length >= 3 && (
          <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No se encontraron productos</h3>
            <p className="text-gray-500 mt-2">Intenta con otros términos de búsqueda o revisa el código del producto.</p>
          </div>
        )}

        {!hasSearched && search.length < 3 && (
          <div className="bg-white rounded-3xl p-16 text-center border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-[#003087]/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-[#003087]/30" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Comienza tu búsqueda</h3>
            <p className="text-gray-500 mt-2">Ingresa al menos 3 caracteres para buscar el historial de un producto.</p>
          </div>
        )}

        {results.map((product) => (
          <div key={product.producto_id} className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden transition-all hover:shadow-2xl hover:border-blue-100">
            {/* Product Summary Header */}
            <div className="bg-gradient-to-r from-[#003087] to-[#004dc7] px-8 py-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">{product.producto_nombre}</h2>
                    <p className="text-blue-100/70 text-xs font-mono mt-0.5">CÓDIGO: {product.producto_codigo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-sm border border-white/10">
                    {product.historial.length} cambios registrados
                  </span>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 text-[11px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                    <th className="px-8 py-4 text-left">Fecha de Cambio</th>
                    <th className="px-8 py-4 text-right">PVP Anterior</th>
                    <th className="px-8 py-4 text-center"></th>
                    <th className="px-8 py-4 text-right">Nuevo PVP</th>
                    <th className="px-8 py-4 text-right">Variación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {product.historial.map((entry, idx) => (
                    <tr key={entry.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{formatDate(entry.fecha_cambio)}</span>
                          <span className="text-[10px] text-gray-400 font-medium">Actualizado por sistema</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-medium text-gray-500 text-sm">
                        {entry.pvp_anterior ? formatCurrency(entry.pvp_anterior) : '—'}
                      </td>
                      <td className="px-4 py-5 text-center">
                        <ArrowRight className="w-4 h-4 text-gray-300 mx-auto group-hover:text-[#003087] group-hover:translate-x-1 transition-all" />
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="text-base font-black text-gray-900">{formatCurrency(entry.pvp_nuevo)}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        {entry.variacion_porcentaje !== null ? (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${getVariationColor(entry.variacion_porcentaje)}`}>
                            {getVariationIcon(entry.variacion_porcentaje)}
                            {entry.variacion_porcentaje > 0 ? '+' : ''}{entry.variacion_porcentaje.toFixed(2)}%
                          </div>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-gray-50 text-gray-400 text-xs font-bold">Inicial</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {product.historial.length === 0 && (
              <div className="p-10 text-center text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>No hay historial de precios para este producto.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}