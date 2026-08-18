'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardCheck, Search, RefreshCw, PackageCheck, Loader2, CalendarClock, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

interface PreparacionItem {
  producto: string
  codigo: string | null
  presentacion: string | null
  cantidad: number
  unidad: string
  cantidad_cajas: number
  cantidad_blisters: number
}

interface PreparacionPedido {
  id: number
  numero_pedido: string
  cliente: string
  fecha: string | null
  fecha_entrega: string | null
  observacion: string | null
  items: PreparacionItem[]
}

export default function PreparacionPage() {
  useAuth()
  const [search, setSearch] = useState('')
  const [data, setData] = useState<PreparacionPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<number | null>(null)

  const fetchPreparacion = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ items: PreparacionPedido[]; total: number }>('/pedidos/preparacion', {
        params: { search },
      })
      setData(res.data.items)
    } catch {
      toast.error('Error al cargar la cola de preparación')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchPreparacion, 250)
    return () => clearTimeout(t)
  }, [fetchPreparacion])

  const marcarListo = useCallback(async (pedido: PreparacionPedido) => {
    setMarcando(pedido.id)
    try {
      await api.patch(`/pedidos/${pedido.id}/shipping-status`, { shipping_status: 'listo_para_despacho' })
      toast.success(`Pedido ${pedido.numero_pedido} listo para despacho`)
      // Sale de la cola de preparación.
      setData((prev) => prev.filter((p) => p.id !== pedido.id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'No se pudo cambiar el estado')
    } finally {
      setMarcando(null)
    }
  }, [])

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#003087]/10">
            <ClipboardCheck className="w-6 h-6 text-[#003087]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Preparación de pedidos</h1>
            <p className="text-sm text-gray-500 mt-1">Armá los pedidos en preparación y marcalos listos para despacho.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchPreparacion}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número de pedido o cliente..."
          className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
        />
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 text-center">
          <div className="p-4 rounded-full bg-green-50 mb-3">
            <PackageCheck className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-gray-700 font-medium">No hay pedidos en preparación</p>
          <p className="text-sm text-gray-400 mt-1">Todo lo pendiente de armado ya fue despachado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((pedido) => (
            <div key={pedido.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-start justify-between p-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{pedido.numero_pedido}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">En preparación</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{pedido.cliente}</p>
                  {pedido.fecha_entrega && (
                    <p className="text-xs text-gray-400 mt-1 inline-flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" /> Entrega: {formatDate(pedido.fecha_entrega)}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 font-medium inline-flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> {pedido.items.length} ítem{pedido.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Lista de mercadería (SIN importes) */}
              <div className="p-4 flex-1">
                <ul className="divide-y divide-gray-50">
                  {pedido.items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between py-2 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{it.producto}</p>
                        {(it.codigo || it.presentacion) && (
                          <p className="text-xs text-gray-400 truncate">
                            {[it.codigo, it.presentacion].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[#003087] bg-[#003087]/5 px-2.5 py-1 rounded-lg">
                        {it.cantidad} {it.unidad}{it.cantidad !== 1 ? 's' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                {pedido.observacion && (
                  <p className="mt-3 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="font-medium text-amber-700">Obs:</span> {pedido.observacion}
                  </p>
                )}
              </div>

              <div className="p-4 pt-0">
                <button
                  type="button"
                  onClick={() => marcarListo(pedido)}
                  disabled={marcando === pedido.id}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] transition-colors active:scale-[0.99] disabled:opacity-50"
                >
                  {marcando === pedido.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                  Listo para despacho
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
