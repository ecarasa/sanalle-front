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
  Info
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

export default function HistorialPvpPage() {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<HistorialPvpResponse[]>([])
  const [hasSearched, setHasSearched] = useState(false)

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