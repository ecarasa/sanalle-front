'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Eye, X, Truck, FileText, MapPin, Phone, UserPlus, List, Map as MapIcon, ChevronDown, ChevronRight, ChevronLeft, Lock, Layers } from 'lucide-react'
import AsignarRepartidorModal from '@/components/pedidos/AsignarRepartidorModal'
import EditarUbicacionModal from '@/components/entregas/EditarUbicacionModal'

import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { abrirPedidoPdf } from '@/lib/pedidoPdf'
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

type ShippingFilter = 'en_preparacion' | 'listo_para_despacho' | 'en_camino' | 'entregado'

// Logística ya no muestra "Todos" ni "Pendiente". El admin ve además "En Preparación";
// la logística (repartidor) solo ve despacho → camino → entregado.
const SHIPPING_TABS: { label: string; value: ShippingFilter }[] = [
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

/** Color de la zona según palabra clave (norte/sur/este/oeste/centro), con fallback neutro. */
function zonaColor(nombre: string): { header: string; dot: string; chip: string } {
  const n = nombre.toLowerCase()
  if (n.includes('norte')) return { header: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700 border-sky-200' }
  if (n.includes('sur')) return { header: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  if (n.includes('este')) return { header: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700 border-amber-200' }
  if (n.includes('oeste')) return { header: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700 border-violet-200' }
  if (n.includes('centro')) return { header: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700 border-rose-200' }
  if (n === 'sin zona') return { header: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-500 border-gray-200' }
  return { header: 'bg-[#003087]/5 border-[#003087]/15', dot: 'bg-[#003087]', chip: 'bg-[#003087]/10 text-[#003087] border-[#003087]/20' }
}

export default function EntregasPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'
  const [search, setSearch] = useState('')
  const [shippingFilter, setShippingFilter] = useState<ShippingFilter>('listo_para_despacho')
  const [dataAll, setDataAll] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [conteoPorFecha, setConteoPorFecha] = useState<Record<string, number>>({})

  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignPedidoId, setAssignPedidoId] = useState<number | null>(null)
  const [editUbicacionPedido, setEditUbicacionPedido] = useState<Pedido | null>(null)
  const [mapKey, setMapKey] = useState(0)
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const hoyStr = new Date().toISOString().split('T')[0]
  // Fecha de entrega seleccionada (compartida entre lista y mapa).
  const [fechaSel, setFechaSel] = useState<string>(hoyStr)
  // Vista "sin fecha": todo lo que está pendiente de despacho, sin importar para
  // qué día quedó agendado. Un pedido que se termina de armar hoy pero se entrega
  // pasado mañana no aparecía en ninguna pantalla hasta ese día.
  const [sinFecha, setSinFecha] = useState(false)
  // El admin ve todos los estados de logística; la logística (repartidor) no ve "En Preparación".
  // En la vista sin fecha quedan solo los estados que son trabajo abierto: incluir
  // "entregado" sin acotar por día traería el historial completo.
  const visibleTabs = useMemo(() => {
    const base = isAdmin ? SHIPPING_TABS : SHIPPING_TABS.filter((t) => t.value !== 'en_preparacion')
    if (!sinFecha) return base
    return base.filter((t) => t.value === 'listo_para_despacho' || t.value === 'en_camino')
  }, [isAdmin, sinFecha])

  const esHoy = fechaSel === hoyStr
  // En la vista sin fecha no hay un "día futuro" que bloquear: se está mirando
  // trabajo abierto, y sobre eso se opera.
  const esFuturo = !sinFecha && fechaSel > hoyStr   // entregas de días futuros → solo lectura
  const esPasado = !sinFecha && fechaSel < hoyStr

  // Navegación por día (+/- n días respecto a la fecha seleccionada).
  const moverDia = (delta: number) => {
    const d = new Date(fechaSel + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setFechaSel(d.toISOString().split('T')[0])
  }
  const fechaLarga = (() => {
    try {
      return new Date(fechaSel + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })
    } catch { return fechaSel }
  })()

  // Tira de 9 fechas: 4 días atrás, la seleccionada, 4 días adelante.
  const fechasCercanas = useMemo(() => {
    const base = new Date(fechaSel + 'T00:00:00')
    return Array.from({ length: 9 }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + (i - 4))
      const iso = d.toISOString().split('T')[0]
      return {
        iso,
        diaSemana: d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
        diaMes: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        esHoy: iso === hoyStr,
      }
    })
  }, [fechaSel, hoyStr])
  const [zonaFiltro, setZonaFiltro] = useState<string | null>(null)
  const [clientesExpandidos, setClientesExpandidos] = useState<Set<number>>(new Set())


  const debouncedSearch = useDebounce(search, 400)

  // Pedidos del filtro de estado activo (dataAll trae todos los estados de la fecha).
  const data = useMemo(
    () => dataAll.filter((p) => p.shipping_status === shippingFilter),
    [dataAll, shippingFilter]
  )

  // Cantidad de pedidos por estado, para mostrar entre paréntesis en los tabs.
  const conteoPorEstado = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of dataAll) counts[p.shipping_status] = (counts[p.shipping_status] || 0) + 1
    return counts
  }, [dataAll])

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

  // Agrupados por zona (Norte / Sur / Este / … y "Sin zona" al final).
  const zonasAgrupadas = useMemo(() => {
    const map = new Map<string, { pedidos: Pedido[] }[]>()
    for (const grupo of clientesAgrupados) {
      const zona = grupo.pedidos[0].cliente_zona || 'Sin zona'
      if (!map.has(zona)) map.set(zona, [])
      map.get(zona)!.push(grupo)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a === 'Sin zona' ? 1 : b === 'Sin zona' ? -1 : a.localeCompare(b, 'es')))
      .map(([zona, clientes]) => ({
        zona,
        clientes,
        totalPedidos: clientes.reduce((s, c) => s + c.pedidos.length, 0),
        totalBultos: clientes.reduce((s, c) => s + c.pedidos.reduce((ss, p) => ss + (p.bultos || 0), 0), 0),
        totalCobrar: clientes.reduce((s, c) => s + c.pedidos.reduce((ss, p) => ss + (p.saldo_pendiente > 0 ? p.saldo_pendiente : 0), 0), 0),
      }))
  }, [clientesAgrupados])

  const [zonasColapsadas, setZonasColapsadas] = useState<Set<string>>(new Set())
  const toggleZona = (zona: string) => {
    setZonasColapsadas(prev => {
      const next = new Set(prev)
      if (next.has(zona)) next.delete(zona)
      else next.add(zona)
      return next
    })
  }

  const toggleCliente = (clienteId: number) => {
    setClientesExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(clienteId)) next.delete(clienteId)
      else next.add(clienteId)
      return next
    })
  }

  // Resumen del conjunto filtrado (para las tarjetas de arriba).
  const resumen = useMemo(() => ({
    entregas: datosFiltrados.length,
    clientes: clientesAgrupados.length,
    bultos: datosFiltrados.reduce((s, p) => s + (p.bultos || 0), 0),
    aCobrar: datosFiltrados.reduce((s, p) => s + (p.saldo_pendiente > 0 ? p.saldo_pendiente : 0), 0),
  }), [datosFiltrados, clientesAgrupados])

  const expandirTodos = () => setClientesExpandidos(new Set(clientesAgrupados.map(c => c.pedidos[0].cliente_id)))
  const colapsarTodos = () => setClientesExpandidos(new Set())

  const fetchEntregas = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        search: debouncedSearch,
        page: 1,
        page_size: 500,
        sort_by: 'fecha_entrega',
        sort_dir: 'asc',
        // Una cotización con una fecha_entrega sugerida no es una entrega real.
        tipo: 'pedido',
      }
      if (sinFecha) {
        // Sin acotar por día hay que acotar por estado: pedir todo traería el
        // histórico completo y se comería el tope de 500.
        params.estados = 'listo_para_despacho,en_camino'
      } else {
        params.fecha_entrega = fechaSel
      }
      // Traemos todos los estados de la fecha (no solo el filtro activo) para poder
      // mostrar la cantidad de pedidos de cada estado entre paréntesis en los tabs.
      if (user?.rol !== 'admin' && user?.rol !== 'super_admin') params.repartidor_id = user?.id || 0

      const res = await api.get<PaginatedResponse<Pedido>>('/pedidos', { params })
      setDataAll(res.data.items)
    } catch {
      toast.error('Error al cargar entregas')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, user, fechaSel, sinFecha])

  useEffect(() => {
    fetchEntregas()
  }, [fetchEntregas])

  // Al pasar a "sin fecha", si la solapa activa no está entre las visibles
  // (ej. En Preparación) la vista quedaría vacía sin explicación.
  useEffect(() => {
    if (sinFecha && !visibleTabs.some((t) => t.value === shippingFilter)) {
      setShippingFilter('listo_para_despacho')
    }
  }, [sinFecha, visibleTabs, shippingFilter])

  // Cantidad total de pedidos por fecha de entrega (para la tira de fechas de arriba).
  useEffect(() => {
    api.get<{ fecha: string; count: number }[]>('/pedidos/calendario')
      .then((res) => {
        const map: Record<string, number> = {}
        for (const row of res.data) map[row.fecha] = row.count
        setConteoPorFecha(map)
      })
      .catch(() => {})
  }, [])

  const handleStatusChange = async (pedidoId: number, newStatus: string) => {
    try {
      await api.patch(`/pedidos/${pedidoId}/shipping-status`, { shipping_status: newStatus })
      toast.success('Estado actualizado')
      // Seguir al pedido a su nueva solapa. Si no, al tocar "Iniciar" el pedido
      // sale de la solapa actual y la pantalla queda vacía sin explicar a dónde
      // se fue, que desde el celular es peor todavía.
      if (visibleTabs.some((t) => t.value === newStatus)) {
        setShippingFilter(newStatus as ShippingFilter)
      }
      fetchEntregas()
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  // Bultos y despachado son datos de depósito/logística: van por el endpoint
  // propio, que sigue abierto con el pedido ya fuera de `pendiente`.
  const handleLogistica = async (
    pedidoId: number,
    cambios: { bultos?: number; despachado?: boolean },
  ) => {
    try {
      await api.patch(`/pedidos/${pedidoId}/logistica`, cambios)
      fetchEntregas()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'No se pudo guardar')
    }
  }

  const handleViewPdf = (pedidoId: number) => abrirPedidoPdf(pedidoId)


  return (
    <div className="space-y-4">
      {/* Header — título · navegación por día · vista */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Logística</h1>
            <p className="mt-0.5 text-sm text-gray-500">{isAdmin ? 'Entregas, ruta y despacho' : 'Mis entregas del día'}</p>
          </div>
        </div>

        {/* Navegación por día (compartida lista/mapa) */}
        <div className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 shadow-sm transition-opacity ${sinFecha ? 'opacity-40 pointer-events-none' : ''} ${esHoy ? 'bg-[#003087]/5 border-[#003087]/20' : esFuturo ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <button onClick={() => moverDia(-1)} className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors" title="Día anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[170px]">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-sm font-bold text-gray-900 capitalize">{fechaLarga}</span>
              {esHoy && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#003087] text-white">Hoy</span>}
              {esFuturo && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500 text-white">Futuro</span>}
              {esPasado && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gray-400 text-white">Pasado</span>}
            </div>
            <input
              type="date"
              value={fechaSel}
              onChange={(e) => setFechaSel(e.target.value || hoyStr)}
              className="text-[11px] text-gray-500 bg-transparent text-center focus:outline-none cursor-pointer"
            />
          </div>
          <button onClick={() => moverDia(1)} className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors" title="Día siguiente">
            <ChevronRight size={18} />
          </button>
          {!esHoy && (
            <button onClick={() => setFechaSel(hoyStr)} className="px-2.5 py-1.5 text-xs font-semibold text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors">
              Hoy
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setSinFecha((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border shadow-sm transition-colors ${sinFecha
              ? 'bg-[#00AEEF] text-white border-[#00AEEF]'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            title="Todo lo que está por despacharse, sin importar para qué día quedó agendado"
          >
            <Layers size={15} />
            Todos los pendientes
          </button>
          <div className={`flex rounded-lg border border-gray-300 overflow-hidden shadow-sm ${sinFecha ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              onClick={() => setVista('lista')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors ${vista === 'lista' ? 'bg-[#003087] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={15} />
              Lista
            </button>
            <button
              onClick={() => setVista('mapa')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${vista === 'mapa' ? 'bg-[#003087] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <MapIcon size={15} />
              Mapa
            </button>
          </div>
        </div>
      </div>

      {sinFecha && (
        <div className="flex items-center gap-2 rounded-xl border border-[#00AEEF]/30 bg-[#00AEEF]/5 px-3.5 py-2.5">
          <Layers size={16} className="text-[#00AEEF] shrink-0" />
          <p className="text-sm text-gray-700">
            Mostrando <strong>todos los pedidos pendientes de despacho</strong>, sin filtrar por
            fecha de entrega. La fecha agendada de cada uno se ve en su renglón.
          </p>
        </div>
      )}

      {/* Tira de fechas: 4 días atrás, la seleccionada, 4 adelante — con cantidad total de pedidos de cada día */}
      <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 ${sinFecha ? 'hidden' : ''}`}>
        {fechasCercanas.map((f) => {
          const activa = f.iso === fechaSel
          return (
            <button
              key={f.iso}
              onClick={() => setFechaSel(f.iso)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${activa
                ? 'bg-[#003087] border-[#003087] text-white'
                : f.esHoy
                  ? 'bg-[#003087]/5 border-[#003087]/30 text-[#003087] hover:bg-[#003087]/10'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <span className="capitalize">{f.diaSemana} {f.diaMes}</span>
              <span className={`font-bold ${activa ? 'text-white' : 'text-gray-400'}`}>({conteoPorFecha[f.iso] || 0})</span>
            </button>
          )
        })}
      </div>

      {/* Aviso de solo lectura para días futuros */}
      {esFuturo && (
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
          <Lock size={13} /> Entregas futuras: solo lectura
        </div>
      )}

      {vista === 'mapa' ? (
        <MapaEntregas key={`${mapKey}-${fechaSel}`} fecha={fechaSel} />
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Entregas', value: resumen.entregas, color: 'text-[#003087]', bg: 'bg-[#003087]/10', icon: <Truck className="w-5 h-5 text-[#003087]" /> },
              { label: 'Clientes', value: resumen.clientes, color: 'text-[#0086c3]', bg: 'bg-[#00AEEF]/10', icon: <MapPin className="w-5 h-5 text-[#0086c3]" /> },
              { label: 'Bultos', value: resumen.bultos, color: 'text-amber-600', bg: 'bg-amber-100', icon: <List className="w-5 h-5 text-amber-600" /> },
              { label: 'A cobrar', value: formatCurrency(resumen.aCobrar), color: 'text-red-600', bg: 'bg-red-100', icon: <FileText className="w-5 h-5 text-red-600" /> },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${c.bg}`}>{c.icon}</div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color} truncate`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setShippingFilter(tab.value)}
                  className={`px-3.5 py-1.5 text-sm font-medium rounded-full border transition-colors ${shippingFilter === tab.value
                    ? 'bg-[#003087] text-white border-[#003087]'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {tab.label} ({conteoPorEstado[tab.value] || 0})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="relative w-full sm:w-auto">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nº pedido o cliente..."
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] w-full sm:w-72"
                />
              </div>
              {zonas.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">Zona:</span>
                  <button
                    onClick={() => setZonaFiltro(null)}
                    className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors ${zonaFiltro === null ? 'bg-[#00AEEF] text-white border-[#00AEEF]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Todas
                  </button>
                  {zonas.map(zona => (
                    <button
                      key={zona}
                      onClick={() => setZonaFiltro(zona)}
                      className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors ${zonaFiltro === zona ? 'bg-[#00AEEF] text-white border-[#00AEEF]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {zona}
                    </button>
                  ))}
                </div>
              )}
              {clientesAgrupados.length > 0 && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <button onClick={expandirTodos} className="px-2 py-2 text-[#003087] font-medium hover:underline">Expandir todo</button>
                  <span className="text-gray-300">·</span>
                  <button onClick={colapsarTodos} className="px-2 py-2 text-gray-500 font-medium hover:underline">Colapsar</button>
                </div>
              )}
            </div>
          </div>

          {/* Lista agrupada por cliente */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003087] mr-3" />
              Cargando...
            </div>
          ) : clientesAgrupados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 text-center py-16 text-gray-400 text-sm">No hay entregas para mostrar</div>
          ) : (
            <div className="space-y-5">
              {zonasAgrupadas.map((grupoZona) => {
                const zc = zonaColor(grupoZona.zona)
                const zonaColapsada = zonasColapsadas.has(grupoZona.zona)
                return (
                  <div key={grupoZona.zona} className="space-y-2">
                    {/* Encabezado de zona */}
                    <button
                      onClick={() => toggleZona(grupoZona.zona)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors hover:brightness-[0.98] ${zc.header}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${zc.dot}`} />
                      <span className="font-bold text-gray-800">{grupoZona.zona}</span>
                      <span className="text-xs text-gray-500">
                        {grupoZona.clientes.length} cliente{grupoZona.clientes.length > 1 ? 's' : ''} · {grupoZona.totalPedidos} pedido{grupoZona.totalPedidos > 1 ? 's' : ''}{grupoZona.totalBultos > 0 ? ` · ${grupoZona.totalBultos} bultos` : ''}
                      </span>
                      <span className="ml-auto flex items-center gap-3">
                        {grupoZona.totalCobrar > 0 && <span className="text-sm font-bold text-red-600">{formatCurrency(grupoZona.totalCobrar)}</span>}
                        <span className="text-gray-400">{zonaColapsada ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</span>
                      </span>
                    </button>

                    {/* Clientes de la zona */}
                    {!zonaColapsada && (
                      <div className="space-y-2 pl-1">
                        {grupoZona.clientes.map(({ pedidos }) => {
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
                          <span className="text-xs text-gray-400">
                            {pedidos.length} pedido{pedidos.length > 1 ? 's' : ''} {bultosTotales > 0 && `· ${bultosTotales} bultos`}
                          </span>
                        </div>
                        {/* Dirección — bien visible para el reparto */}
                        {rep.cliente_domicilio ? (
                          <div className="flex items-start gap-1.5 mt-1 text-sm text-gray-700 font-medium">
                            <MapPin size={14} className="mt-0.5 flex-shrink-0 text-[#00AEEF]" />
                            <span>
                              {rep.cliente_domicilio}
                              {rep.cliente_localidad ? <span className="text-gray-500">, {rep.cliente_localidad}</span> : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600">
                            <MapPin size={13} className="flex-shrink-0" />
                            Sin domicilio cargado
                          </div>
                        )}
                        {rep.cliente_telefono && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                            <Phone size={11} />
                            {rep.cliente_telefono}
                          </div>
                        )}
                      </div>
                      <span className={`flex-shrink-0 font-bold text-sm ${saldoTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(saldoTotal)}
                      </span>
                    </button>

                    {/* Pedidos del cliente */}
                    {expandido && (
                      <div className="border-t divide-y bg-gray-50/50">
                        {pedidos.map((row) => (
                          <div key={row.id} className="px-4 py-3 space-y-2">
                            {/* Datos del pedido */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-800">{row.numero_pedido}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SHIPPING_BADGE[row.shipping_status] || 'bg-gray-100'}`}>
                                {SHIPPING_LABEL[row.shipping_status] || row.shipping_status}
                              </span>
                              <span className="text-xs text-gray-500">Entrega: {row.fecha_entrega}</span>
                              <span className={`ml-auto text-sm font-bold ${row.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(row.saldo_pendiente)}
                              </span>
                            </div>

                            {/* Acciones. Los botones tienen 40px de alto porque esta
                                pantalla se usa desde el celular en la calle. */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {esFuturo ? (
                                row.bultos > 0 && (
                                  <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2.5 py-2 rounded-lg">
                                    {row.bultos} bultos
                                  </span>
                                )
                              ) : (
                                <label className="inline-flex items-center gap-1.5 h-10 px-2.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg">
                                  <input
                                    type="number"
                                    min={0}
                                    defaultValue={row.bultos}
                                    onBlur={(e) => {
                                      const valor = parseInt(e.target.value, 10) || 0
                                      if (valor !== row.bultos) handleLogistica(row.id, { bultos: valor })
                                    }}
                                    className="w-12 px-1 py-1 text-sm text-right border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#003087]/30"
                                    title="Bultos"
                                  />
                                  bultos
                                </label>
                              )}

                              {!esFuturo && (
                                <label
                                  className={`inline-flex items-center gap-2 h-10 px-3 text-sm font-medium rounded-lg border cursor-pointer select-none transition-colors ${row.despachado
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                    : 'bg-white border-gray-200 text-gray-600'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={row.despachado}
                                    onChange={(e) => handleLogistica(row.id, { despachado: e.target.checked })}
                                    className="w-5 h-5 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20"
                                  />
                                  Despachado
                                </label>
                              )}

                              {!esFuturo && row.shipping_status === 'listo_para_despacho' && (
                                <button
                                  onClick={() => handleStatusChange(row.id, 'en_camino')}
                                  className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#003087] text-white text-sm font-semibold rounded-lg hover:bg-[#002570] transition-colors"
                                >
                                  <Truck size={16} /> Iniciar
                                </button>
                              )}
                              {!esFuturo && row.shipping_status === 'en_camino' && (
                                <button
                                  onClick={() => handleStatusChange(row.id, 'entregado')}
                                  className="inline-flex items-center gap-1.5 h-10 px-4 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  <Truck size={16} /> Entregar
                                </button>
                              )}

                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  onClick={() => { setSelectedPedido(row); setShowDetailModal(true) }}
                                  className="inline-flex items-center justify-center h-10 w-10 text-gray-600 bg-white border rounded-lg hover:bg-gray-100 transition-colors"
                                  title="Ver Detalle"
                                >
                                  <Eye size={16} />
                                </button>
                                {!esFuturo && (
                                  <button
                                    onClick={() => setEditUbicacionPedido(row)}
                                    className="inline-flex items-center justify-center h-10 w-10 text-[#00AEEF] bg-white border rounded-lg hover:bg-[#00AEEF]/10 transition-colors"
                                    title="Cambiar punto de entrega"
                                  >
                                    <MapPin size={16} />
                                  </button>
                                )}
                                {isAdmin && !esFuturo && (
                                  <button
                                    onClick={() => { setAssignPedidoId(row.id); setShowAssignModal(true) }}
                                    className="inline-flex items-center justify-center h-10 w-10 text-[#003087] bg-white border rounded-lg hover:bg-[#003087]/10 transition-colors"
                                    title="Asignar Repartidor"
                                  >
                                    <UserPlus size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleViewPdf(row.id)}
                                  className="inline-flex items-center justify-center h-10 w-10 text-red-600 bg-white border rounded-lg hover:bg-red-50 transition-colors"
                                  title="Ver Remito"
                                >
                                  <FileText size={16} />
                                </button>
                                {esFuturo && (
                                  <span className="text-[10px] font-medium text-amber-600 inline-flex items-center gap-1">
                                    <Lock size={11} /> solo lectura
                                  </span>
                                )}
                              </div>
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
