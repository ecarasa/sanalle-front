'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Eye, X, Truck, FileText, MapPin, Phone, UserPlus, List, Map as MapIcon, ChevronDown, ChevronRight } from 'lucide-react'
import AsignarRepartidorModal from '@/components/pedidos/AsignarRepartidorModal'
import EditarUbicacionModal from '@/components/entregas/EditarUbicacionModal'

import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import { Pedido, PaginatedResponse } from '@/types'


const MapaEntregas = dynamic(
  () => import('@/components/entregas/MapaEntregas'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-xl border">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    ),
  }
)

type ShippingFilter = '' | 'pendiente' | 'en_preparacion' | 'listo_para_despacho' | 'en_camino' | 'entregado'

const SHIPPING_TABS: { label: string; value: ShippingFilter }[] = [
  { label: 'Todos', value: '' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'En Preparación', value: 'en_preparacion' },
  { label: 'Listo Despacho', value: 'listo_para_despacho' },
  { label: 'En Camino', value: 'en_camino' },
  { label: 'Entregado', value: 'entregado' },
]

const SHIPPING_BADGE: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_preparacion: 'bg-sky-300 text-gray-700',
  listo_para_despacho: 'bg-cyan-100 text-cyan-700',
  en_camino: 'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
}

const SHIPPING_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo_para_despacho: 'Listo Despacho',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const PRECIO_BADGE: Record<string, string> = {
  mayorista: 'bg-blue-100 text-blue-700',
  minorista: 'bg-slate-100 text-slate-700',
}

const PRECIO_LABEL: Record<string, string> = {
  mayorista: 'Mayorista',
  minorista: 'Minorista',
}

export default function EntregasPage() {
  const { user } = useAuth()
  console.log(user)
  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'
  const [search, setSearch] = useState('')
  const [shippingFilter, setShippingFilter] = useState<ShippingFilter>('listo_para_despacho')
  const [data, setData] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignPedidoId, setAssignPedidoId] = useState<number | null>(null)
  const [editUbicacionPedido, setEditUbicacionPedido] = useState<Pedido | null>(null)
  const [mapKey, setMapKey] = useState(0)
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [fechaMapa, setFechaMapa] = useState<string>(new Date().toISOString().split('T')[0])
  const [zonaFiltro, setZonaFiltro] = useState<string | null>(null)
  const [clientesExpandidos, setClientesExpandidos] = useState<Set<number>>(new Set())


  const debouncedSearch = useDebounce(search, 400)

  // Zonas únicas presentes en los datos cargados
  const zonas = useMemo(() => {
    const set = new Set<string>()
    for (const p of data) if (p.cliente_zona) set.add(p.cliente_zona)
    return Array.from(set).sort()
  }, [data])

  // Pedidos filtrados por zona activa
  const datosFiltrados = useMemo(
    () => (zonaFiltro ? data.filter(p => p.cliente_zona === zonaFiltro) : data),
    [data, zonaFiltro]
  )

  // Agrupados por cliente
  const clientesAgrupados = useMemo(() => {
    const map = new Map<number, { pedidos: Pedido[] }>()
    for (const p of datosFiltrados) {
      if (!map.has(p.cliente_id)) map.set(p.cliente_id, { pedidos: [] })
      map.get(p.cliente_id)!.pedidos.push(p)
    }
    return Array.from(map.values())
  }, [datosFiltrados])

  const toggleCliente = (clienteId: number) => {
    setClientesExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(clienteId)) next.delete(clienteId)
      else next.add(clienteId)
      return next
    })
  }

  const fetchEntregas = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        search: debouncedSearch,
        page: 1,
        page_size: 200,
        sort_by: 'fecha_entrega',
        sort_dir: 'asc',
      }
      if (shippingFilter) params.shipping_status = shippingFilter
      if (user?.rol !== 'admin' && user?.rol !== 'super_admin') params.repartidor_id = user?.id || 0

      const res = await api.get<PaginatedResponse<Pedido>>('/pedidos', { params })
      setData(res.data.items)
    } catch {
      toast.error('Error al cargar entregas')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, shippingFilter, user])

  useEffect(() => {
    fetchEntregas()
  }, [fetchEntregas])

  const handleStatusChange = async (pedidoId: number, newStatus: string) => {
    try {
      await api.patch(`/pedidos/${pedidoId}/shipping-status`, { shipping_status: newStatus })
      toast.success('Estado actualizado')
      fetchEntregas()
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  const handleViewPdf = async (pedidoId: number) => {
    try {
      const res = await api.get(`/pedidos/${pedidoId}/pdf`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      toast.error('Error al abrir PDF')
    }
  }


  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Entregas</h1>

        </div>
        <div className="flex items-center gap-2">
          {vista === 'mapa' && (
            <input
              type="date"
              value={fechaMapa}
              onChange={e => setFechaMapa(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setVista('lista')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${vista === 'lista' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={15} />
              Lista
            </button>
            <button
              onClick={() => setVista('mapa')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${vista === 'mapa' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <MapIcon size={15} />
              Mapa
            </button>
          </div>
        </div>
      </div>

      {vista === 'mapa' ? (
        <MapaEntregas key={mapKey} fecha={fechaMapa} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {SHIPPING_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setShippingFilter(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${shippingFilter === tab.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtro búsqueda + zona */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nº pedido o cliente..."
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            {zonas.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium">Zona:</span>
                <button
                  onClick={() => setZonaFiltro(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${zonaFiltro === null ? 'bg-[#003087] text-white border-[#003087]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  Todas
                </button>
                {zonas.map(zona => (
                  <button
                    key={zona}
                    onClick={() => setZonaFiltro(zona)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${zonaFiltro === zona ? 'bg-[#003087] text-white border-[#003087]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {zona}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista agrupada por cliente */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
              Cargando...
            </div>
          ) : clientesAgrupados.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No hay entregas para mostrar</div>
          ) : (
            <div className="space-y-3">
              {clientesAgrupados.map(({ pedidos }) => {
                const rep = pedidos[0]
                const clienteId = rep.cliente_id
                const expandido = clientesExpandidos.has(clienteId)
                const saldoTotal = pedidos.reduce((s, p) => s + p.saldo_pendiente, 0)
                const bultosTotales = pedidos.reduce((s, p) => s + (p.bultos || 0), 0)

                return (
                  <div key={clienteId} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    {/* Header del cliente — click para expandir */}
                    <button
                      onClick={() => toggleCliente(clienteId)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-gray-400 flex-shrink-0">
                        {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{rep.cliente_nombre}</span>
                          {rep.cliente_zona && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-100">
                              {rep.cliente_zona}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {pedidos.length} pedido{pedidos.length > 1 ? 's' : ''} {bultosTotales > 0 && `· ${bultosTotales} bultos`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          {rep.cliente_domicilio && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {rep.cliente_domicilio}
                              {rep.cliente_localidad ? `, ${rep.cliente_localidad}` : ''}
                            </span>
                          )}
                          {rep.cliente_telefono && (
                            <span className="flex items-center gap-1">
                              <Phone size={10} />
                              {rep.cliente_telefono}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 font-bold text-sm ${saldoTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(saldoTotal)}
                      </span>
                    </button>

                    {/* Pedidos del cliente */}
                    {expandido && (
                      <div className="border-t divide-y bg-gray-50/50">
                        {pedidos.map(row => (
                          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                            <span className="font-semibold text-sm text-gray-800 w-24">{row.numero_pedido}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SHIPPING_BADGE[row.shipping_status] || 'bg-gray-100'}`}>
                              {SHIPPING_LABEL[row.shipping_status] || row.shipping_status}
                            </span>
                            {row.bultos > 0 && (
                              <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                                {row.bultos} bultos
                              </span>
                            )}

                            <span className={`text-sm font-bold ${row.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(row.saldo_pendiente)}
                            </span>
                            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                              <span className='text-xs text-gray-500 mx-2'>Entrega: {row.fecha_entrega}</span>
                              <button
                                onClick={() => { setSelectedPedido(row); setShowDetailModal(true) }}
                                className="p-1.5 text-gray-600 bg-white border rounded hover:bg-gray-100 transition-colors"
                                title="Ver Detalle"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => setEditUbicacionPedido(row)}
                                className="p-1.5 text-blue-600 bg-white border rounded hover:bg-blue-50 transition-colors"
                                title="Cambiar punto de entrega"
                              >
                                <MapPin size={14} />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => { setAssignPedidoId(row.id); setShowAssignModal(true) }}
                                  className="p-1.5 text-blue-600 bg-white border rounded hover:bg-blue-50 transition-colors"
                                  title="Asignar Repartidor"
                                >
                                  <UserPlus size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleViewPdf(row.id)}
                                className="p-1.5 text-red-600 bg-white border rounded hover:bg-red-50 transition-colors"
                                title="Ver Remito"
                              >
                                <FileText size={14} />
                              </button>
                              {row.shipping_status === 'listo_para_despacho' && (
                                <button
                                  onClick={() => handleStatusChange(row.id, 'en_camino')}
                                  className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                  <Truck size={13} /> Iniciar
                                </button>
                              )}
                              {row.shipping_status === 'en_camino' && (
                                <button
                                  onClick={() => handleStatusChange(row.id, 'entregado')}
                                  className="px-2.5 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                                >
                                  <Truck size={13} /> Entregar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal Detalle Simplificado */}
          {showDetailModal && selectedPedido && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-lg font-bold">Pedido {selectedPedido.numero_pedido}</h2>
                  <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500 block">Cliente</label>
                      <span className="font-medium">{selectedPedido.cliente_nombre}</span>
                    </div>
                    <div>
                      <label className="text-gray-500 block">Teléfono</label>
                      <span className="font-medium">{selectedPedido.cliente_telefono || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-500 block">Domicilio</label>
                      <span className="font-medium">{selectedPedido.cliente_domicilio} ({selectedPedido.cliente_localidad})</span>
                    </div>
                    <div>
                      <label className="text-gray-500 block">Saldo a Cobrar</label>
                      <span className="font-bold text-red-600">{formatCurrency(selectedPedido.saldo_pendiente)}</span>
                    </div>
                    <div>
                      <label className="text-gray-500 block">Observación</label>
                      <span className="text-gray-700 italic">{selectedPedido.observacion || 'Sin observaciones'}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold mb-2">Items</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left">Producto</th>
                            <th className="px-4 py-2 text-center">Cant.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedPedido.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2">{item.producto_nombre}</td>
                              <td className="px-4 py-2 text-center font-medium">{item.cantidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => handleViewPdf(selectedPedido.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Ver Remito
                  </button>
                </div>
              </div>
            </div>
          )}

          {editUbicacionPedido && (
            <EditarUbicacionModal
              pedido={editUbicacionPedido}
              onClose={() => setEditUbicacionPedido(null)}
              onSuccess={() => { fetchEntregas(); setMapKey(k => k + 1) }}
            />
          )}

          {showAssignModal && assignPedidoId && (
            <AsignarRepartidorModal
              pedidoId={assignPedidoId}
              isOpen={showAssignModal}
              onClose={() => { setShowAssignModal(false); setAssignPedidoId(null) }}
              onSuccess={fetchEntregas}
            />
          )}
        </>
      )}
    </div>
  )
}
