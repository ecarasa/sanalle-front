'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardCheck, Search, RefreshCw, PackageCheck, Loader2, CalendarClock, Package, Undo2, AlertTriangle, FileText, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { abrirPedidoPdf } from '@/lib/pedidoPdf'

interface PreparacionItem {
  producto: string
  codigo: string | null
  presentacion: string | null
  cantidad: number
  unidad: string
  cantidad_cajas: number
  cantidad_blisters: number
}

type EstadoPreparacion = 'pendiente' | 'en_preparacion' | 'listo_para_despacho'

interface PreparacionPedido {
  id: number
  numero_pedido: string
  cliente: string
  fecha: string | null
  fecha_entrega: string | null
  bultos: number
  shipping_status: EstadoPreparacion
  tipo_documento: string | null
  modalidad_entrega: string | null
  transporte: string | null
  direccion_entrega: string | null
  /** False = el pedido se cargó sin comprometer mercadería. */
  reserva_stock: boolean
  observacion: string | null
  items: PreparacionItem[]
}

/**
 * Las tres etapas que le importan a depósito.
 *
 * `pendiente` está acá porque la fecha de entrega se planifica ANTES de tomar el
 * pedido: no verla era la razón por la que depósito "no podía" cargarla. En esa
 * solapa se editan fecha y bultos, pero no hay botón para tomar el pedido —
 * pasarlo a preparación sigue siendo de ventas o admin.
 */
const TABS: { value: EstadoPreparacion; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'listo_para_despacho', label: 'Listos' },
]

const ESTADO_BADGE: Record<EstadoPreparacion, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-700' },
  en_preparacion: { label: 'En preparación', cls: 'bg-sky-100 text-sky-700' },
  listo_para_despacho: { label: 'Listo para despacho', cls: 'bg-green-100 text-green-700' },
}

export default function PreparacionPage() {
  useAuth()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<EstadoPreparacion>('en_preparacion')
  const [data, setData] = useState<PreparacionPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<number | null>(null)
  const [devolviendo, setDevolviendo] = useState<number | null>(null)
  // Confirmación en dos pasos: devolver a pendiente libera el pedido para que
  // ventas lo cambie, así que no conviene que salga de un clic accidental.
  const [confirmarDevolver, setConfirmarDevolver] = useState<number | null>(null)
  // Bultos y fecha de entrega los carga depósito acá, mientras arma. Van por
  // `PATCH /pedidos/{id}/logistica`, que es el único camino que sigue abierto
  // con el pedido fuera de `pendiente`.
  const [guardandoLogistica, setGuardandoLogistica] = useState<number | null>(null)

  const fetchPreparacion = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ items: PreparacionPedido[]; total: number }>('/pedidos/preparacion', {
        params: { search, estados: tab },
      })
      setData(res.data.items)
    } catch {
      toast.error('Error al cargar la cola de preparación')
    } finally {
      setLoading(false)
    }
  }, [search, tab])

  useEffect(() => {
    const t = setTimeout(fetchPreparacion, 250)
    return () => clearTimeout(t)
  }, [fetchPreparacion])

  // Devolver a "pendiente" es lo único que vuelve editable un pedido: ventas no
  // puede hacerlo por su cuenta una vez que el pedido entró a preparación.
  const devolverAPendiente = useCallback(async (pedido: PreparacionPedido) => {
    setDevolviendo(pedido.id)
    try {
      await api.patch(`/pedidos/${pedido.id}/shipping-status`, { shipping_status: 'pendiente' })
      toast.success(`Pedido ${pedido.numero_pedido} devuelto a pendiente: ya se puede editar`)
      // Sale de la cola de armado hasta que lo vuelvan a poner en preparación.
      setData((prev) => prev.filter((p) => p.id !== pedido.id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'No se pudo devolver el pedido a pendiente')
    } finally {
      setDevolviendo(null)
      setConfirmarDevolver(null)
    }
  }, [])

  // Un pedido ya marcado listo puede volver a preparación para corregir el armado.
  // Es la única transición hacia atrás que el backend le permite a operaciones
  // desde `listo_para_despacho`.
  const reabrirArmado = useCallback(async (pedido: PreparacionPedido) => {
    setDevolviendo(pedido.id)
    try {
      await api.patch(`/pedidos/${pedido.id}/shipping-status`, { shipping_status: 'en_preparacion' })
      toast.success(`Pedido ${pedido.numero_pedido} volvió a preparación`)
      setData((prev) => prev.filter((p) => p.id !== pedido.id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'No se pudo volver a preparación')
    } finally {
      setDevolviendo(null)
    }
  }, [])

  const guardarLogistica = useCallback(
    async (pedido: PreparacionPedido, cambios: { bultos?: number; fecha_entrega?: string | null }) => {
      setGuardandoLogistica(pedido.id)
      try {
        await api.patch(`/pedidos/${pedido.id}/logistica`, cambios)
        setData((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, ...cambios } as PreparacionPedido : p)))
      } catch (err: any) {
        toast.error(err.response?.data?.detail || 'No se pudo guardar')
        // El input muestra el valor optimista; se recarga para no dejarlo mintiendo.
        fetchPreparacion()
      } finally {
        setGuardandoLogistica(null)
      }
    },
    [fetchPreparacion]
  )

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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Depósito</h1>
            <p className="text-sm text-gray-500 mt-1">
              Planificá la entrega, armá los pedidos y marcalos listos para despacho.
            </p>
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

      {/* Etapas */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-full border transition-colors ${tab === t.value
              ? 'bg-[#003087] text-white border-[#003087]'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
          >
            {t.label}
          </button>
        ))}
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
          <p className="text-gray-700 font-medium">
            No hay pedidos en &quot;{TABS.find((t) => t.value === tab)?.label}&quot;
          </p>
          <p className="text-sm text-gray-400 mt-1">Probá en otra etapa o revisá el buscador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((pedido) => (
            <div key={pedido.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-start justify-between p-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{pedido.numero_pedido}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[pedido.shipping_status]?.cls ?? 'bg-gray-100 text-gray-700'}`}>
                      {ESTADO_BADGE[pedido.shipping_status]?.label ?? pedido.shipping_status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{pedido.cliente}</p>
                  {(pedido.modalidad_entrega || pedido.transporte) && (
                    <p className="text-xs text-gray-400 mt-0.5 inline-flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {pedido.modalidad_entrega === 'retira' ? 'Retira el cliente' : 'Envío'}
                      {pedido.transporte ? ` · ${pedido.transporte}` : ''}
                    </p>
                  )}
                  {!pedido.reserva_stock && (
                    <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      Este pedido no descontó stock: la mercadería puede no estar en góndola.
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 font-medium inline-flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> {pedido.items.length} ítem{pedido.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Datos de armado: los carga depósito, y de acá los toma Logística */}
              <div className="grid grid-cols-2 gap-3 px-4 py-3 bg-gray-50/60 border-b border-gray-100">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
                    Bultos
                  </label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={pedido.bultos}
                    disabled={guardandoLogistica === pedido.id}
                    onBlur={(e) => {
                      const valor = parseInt(e.target.value, 10) || 0
                      if (valor !== pedido.bultos) guardarLogistica(pedido, { bultos: valor })
                    }}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1 inline-flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> Fecha de entrega
                  </label>
                  <input
                    type="date"
                    defaultValue={pedido.fecha_entrega ?? ''}
                    disabled={guardandoLogistica === pedido.id}
                    onBlur={(e) => {
                      const valor = e.target.value || null
                      if (valor !== pedido.fecha_entrega) guardarLogistica(pedido, { fecha_entrega: valor })
                    }}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-100"
                  />
                </div>
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

              <div className="p-4 pt-0 space-y-2">
                {/* Siempre sin valores: el personal de armado no tiene por qué ver
                    los precios de venta. El remito valorizado se saca desde
                    Pedidos o Entregas. */}
                <button
                  type="button"
                  onClick={() => abrirPedidoPdf(pedido.id, { sinValores: true })}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  title="Abre el remito sin importes ni descuentos"
                >
                  <FileText className="w-4 h-4" />
                  Remito de armado
                </button>

                {pedido.shipping_status === 'en_preparacion' && (
                  <button
                    type="button"
                    onClick={() => marcarListo(pedido)}
                    disabled={marcando === pedido.id || devolviendo === pedido.id}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] transition-colors active:scale-[0.99] disabled:opacity-50"
                  >
                    {marcando === pedido.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                    Listo para despacho
                  </button>
                )}

                {pedido.shipping_status === 'pendiente' && (
                  <p className="text-center text-xs text-gray-400 px-2 py-1.5">
                    Todavía no lo tomó depósito. Podés fijarle la fecha de entrega y los bultos;
                    pasarlo a preparación lo hace ventas o administración.
                  </p>
                )}

                {/* Volver atrás: sólo desde `listo_para_despacho`, que es la única
                    transición hacia atrás que el backend le permite a operaciones
                    desde ese estado. Desde `pendiente` no hay a dónde volver. */}
                {pedido.shipping_status === 'listo_para_despacho' && (
                  <button
                    type="button"
                    onClick={() => reabrirArmado(pedido)}
                    disabled={devolviendo === pedido.id}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
                    title="Vuelve a preparación para corregir el armado"
                  >
                    {devolviendo === pedido.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                    Volver a preparación
                  </button>
                )}

                {pedido.shipping_status === 'en_preparacion' && (
                  confirmarDevolver === pedido.id ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-xs text-amber-800">
                        El pedido vuelve a <span className="font-bold">Pendiente</span> y sale de esta cola.
                        Ventas va a poder modificarlo.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmarDevolver(null)}
                          className="flex-1 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => devolverAPendiente(pedido)}
                          disabled={devolviendo === pedido.id}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                        >
                          {devolviendo === pedido.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          Confirmar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmarDevolver(pedido.id)}
                      disabled={marcando === pedido.id}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50"
                      title="El pedido vuelve a Pendiente para que ventas lo pueda corregir"
                    >
                      <Undo2 className="w-4 h-4" />
                      Devolver a pendiente para editar
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
