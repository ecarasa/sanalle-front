'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, Edit, X, ClipboardList, Truck, DollarSign, Trash2, FileText, MoreVertical, CreditCard, Plus, History, ListTree, Construction, UserPlus, MapPin, Phone, User, Package, Calendar, Building2, Hash, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import StatCard from '@/components/dashboard/StatCard'
import BitacoraPedido from '@/components/pedidos/BitacoraPedido'
import AsignarRepartidorModal from '@/components/pedidos/AsignarRepartidorModal'
import RegistrarPagoPedidoModal from '@/components/pedidos/RegistrarPagoPedidoModal'
import { GRUPO_BADGE, GRUPO_LABEL, GRUPO_OPTIONS, esGrupo } from '@/lib/listas'
import { Pedido, PaginatedResponse } from '@/types'

type DetailTab = 'detalle' | 'bitacora'

type ShippingFilter = '' | 'borrador' | 'pendiente' | 'en_preparacion' | 'listo_para_despacho' | 'en_camino' | 'entregado' | 'cancelado'
type PaymentFilter = '' | 'pendiente' | 'pagado' | 'parcial' | 'cancelado'

// Sin 'borrador': un pedido confirmado nunca vuelve a estar en borrador salvo
// que depósito lo reabra, así que no vale la pena un tab para eso acá.
const SHIPPING_TABS: { label: string; value: ShippingFilter }[] = [
  { label: 'Todos', value: '' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'En Preparación', value: 'en_preparacion' },
  { label: 'Listo Despacho', value: 'listo_para_despacho' },
  { label: 'En Camino', value: 'en_camino' },
  { label: 'Entregado', value: 'entregado' },
  { label: 'Cancelado', value: 'cancelado' },
]

// Una cotización puede estar en borrador (todavía cargándose) o cancelada sin
// haber llegado a confirmarse. Son los dos únicos estados posibles acá.
const COTIZACION_TABS: { label: string; value: ShippingFilter }[] = [
  { label: 'Todas', value: '' },
  { label: 'Borrador', value: 'borrador' },
  { label: 'Canceladas', value: 'cancelado' },
]

const PAYMENT_TABS: { label: string; value: PaymentFilter }[] = [
  { label: 'Todos', value: '' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Parcial', value: 'parcial' },
  { label: 'Pagado', value: 'pagado' },
  { label: 'Cancelado', value: 'cancelado' },
]

const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const fechaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Traduce el período elegido a fecha_desde/fecha_hasta (por Pedido.fecha). */
function rangoDePeriodo(periodo: string): { desde?: string; hasta?: string } {
  if (periodo === 'todos') return {}
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (periodo === 'hoy') return { desde: fechaLocal(hoy), hasta: fechaLocal(hoy) }
  if (periodo === 'semana') {
    const d = new Date(hoy); d.setDate(d.getDate() - 6)
    return { desde: fechaLocal(d), hasta: fechaLocal(hoy) }
  }
  if (periodo === 'mes') {
    const d = new Date(hoy); d.setDate(d.getDate() - 29)
    return { desde: fechaLocal(d), hasta: fechaLocal(hoy) }
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periodo)
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2])
    return { desde: fechaLocal(new Date(y, mo - 1, 1)), hasta: fechaLocal(new Date(y, mo, 0)) }
  }
  return {}
}

const SHIPPING_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500 border border-dashed border-gray-300',
  pendiente: 'bg-slate-100 text-slate-700',
  en_preparacion: 'bg-sky-300 text-gray-700',
  listo_para_despacho: 'bg-cyan-100 text-cyan-700',
  en_camino: 'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
}

/**
 * Estados en los que el backend acepta borrar un pedido (`DELETE /pedidos/{id}`).
 * Después de `en_preparacion` la mercadería ya se está moviendo y el pedido sólo
 * se cancela, no se borra. Espeja la regla del router: si allá cambia, acá también.
 */
const ESTADOS_ELIMINABLES = ['borrador', 'pendiente', 'en_preparacion']

const SHIPPING_LABEL: Record<string, string> = {
  borrador: 'Cotización',
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo_para_despacho: 'Listo Despacho',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const PAYMENT_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado: 'bg-emerald-100 text-emerald-700',
  parcial: 'bg-orange-100 text-orange-700',
  cancelado: 'bg-red-100 text-red-700',
}

const PAYMENT_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  parcial: 'Parcial',
  cancelado: 'Cancelado',
}

const TIPO_DOC_BADGE: Record<string, string> = {
  remito: 'bg-indigo-100 text-indigo-700',
  factura: 'bg-purple-100 text-purple-700',
}

const SEMAFORO_INFO: Record<string, { label: string; dot: string; text: string }> = {
  rojo: { label: 'Atrasado', dot: 'bg-red-500', text: 'text-red-600' },
  amarillo: { label: 'Por vencer', dot: 'bg-amber-400', text: 'text-amber-600' },
  verde: { label: 'Al día', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  azul: { label: 'Pagado', dot: 'bg-blue-500', text: 'text-blue-600' },
  gris: { label: 'Sin datos', dot: 'bg-gray-300', text: 'text-gray-400' },
}

const SOCIEDAD_BADGE: Record<string, string> = {
  sanalle: 'bg-blue-600 text-white',
  farmacare: 'bg-red-600 text-white',
}

/**
 * Menú de acciones del pedido (kebab). Agrupa todas las acciones secundarias en un
 * único dropdown por portal, para que la columna "Acciones" no ocupe una fila larga
 * de botones. Mantiene el patrón de posicionamiento fixed + click-outside + reposición
 * en scroll que antes usaba el dropdown de PDF.
 */
interface PedidoAccionesMenuProps {
  pedido: Pedido
  isAdmin: boolean
  currentUserId?: number
  onViewPdf: (id: number, sinValores: boolean) => void
  onEdit: () => void
  onEstado: () => void
  onRegistrarPago: () => void
  onAsignar: () => void
  onDelete: () => void
}

function PedidoAccionesMenu({
  pedido,
  isAdmin,
  currentUserId,
  onViewPdf,
  onEdit,
  onEstado,
  onRegistrarPago,
  onAsignar,
  onDelete,
}: PedidoAccionesMenuProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const noFinalizado = pedido.shipping_status !== 'entregado' && pedido.shipping_status !== 'cancelado'
  // Editar mientras el pedido es de ventas: borrador (se está cargando) o
  // pendiente (finalizado, sin tomar). Después ya está en manos de depósito y
  // para corregirlo hay que pedirle que lo devuelva a pendiente.
  const puedeEditar = pedido.shipping_status === 'borrador' || pedido.shipping_status === 'pendiente'
  const puedeEliminar = ESTADOS_ELIMINABLES.includes(pedido.shipping_status)
  // El backend sólo permite registrar el pago a admin/super_admin o al vendedor
  // dueño del pedido (POST /pagos/pedido/{id}) — el botón debe reflejar esa regla.
  const puedePagar =
    pedido.shipping_status !== 'cancelado' &&
    pedido.payment_status !== 'pagado' &&
    pedido.payment_status !== 'cancelado' &&
    (isAdmin || pedido.vendedor_id === currentUserId)

  // Cierra al clickear afuera (contemplando el menú, que va por portal).
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Posiciona el menú (fixed) según el botón; se recalcula al scrollear/redimensionar.
  useEffect(() => {
    if (!open) return
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, left: r.right - 208 }) // w-52 = 208px, alineado a la derecha
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  const itemClass = 'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all hover:scale-105 active:scale-95"
        title="Más acciones"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: Math.max(8, pos.left) }}
          className="w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] py-1 overflow-hidden"
        >
          {puedeEditar && (
            <button type="button" onClick={() => { onEdit(); setOpen(false) }} className={itemClass}>
              <Edit className="w-4 h-4 text-amber-600" />
              Editar pedido
            </button>
          )}
          <button type="button" onClick={() => { onEstado(); setOpen(false) }} className={itemClass}>
            <Truck className="w-4 h-4 text-blue-600" />
            Cambiar estado
          </button>
          {puedePagar && (
            <button type="button" onClick={() => { onRegistrarPago(); setOpen(false) }} className={itemClass}>
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Registrar pago
            </button>
          )}
          <button type="button" onClick={() => { onViewPdf(pedido.id, false); setOpen(false) }} className={itemClass}>
            <FileText className="w-4 h-4 text-green-600" />
            PDF con valores
          </button>
          <button type="button" onClick={() => { onViewPdf(pedido.id, true); setOpen(false) }} className={itemClass}>
            <FileText className="w-4 h-4 text-gray-400" />
            PDF sin valores
          </button>
          {isAdmin && noFinalizado && (
            <button type="button" onClick={() => { onAsignar(); setOpen(false) }} className={itemClass}>
              <UserPlus className="w-4 h-4 text-teal-600" />
              Asignar repartidor
            </button>
          )}
          {puedeEliminar && (
            <button
              type="button"
              onClick={() => { onDelete(); setOpen(false) }}
              className={`${itemClass} border-t border-gray-100 text-red-600 hover:bg-red-50`}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              Eliminar pedido
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

/** Qué listado se está mirando.
 *  - `pedidos`: todo lo confirmado en adelante. No muestra cotizaciones.
 *  - `cotizaciones`: solo los borradores, que son los que todavía se están
 *    armando o son un presupuesto que el cliente no confirmó. */
export type ModoListado = 'pedidos' | 'cotizaciones'

const COPY: Record<ModoListado, { titulo: string; bajada: string; vacio: string }> = {
  pedidos: {
    titulo: 'Pedidos',
    bajada: 'Gestiona los pedidos de venta',
    vacio: 'No hay pedidos en el período',
  },
  cotizaciones: {
    titulo: 'Cotizaciones',
    bajada: 'Pedidos en armado y presupuestos todavía sin confirmar',
    vacio: 'No hay cotizaciones en el período',
  },
}

export default function PedidosListado({ modo = 'pedidos' }: { modo?: ModoListado }) {
  const esCotizaciones = modo === 'cotizaciones'
  const copy = COPY[modo]
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  // El filtro por tipo (cotización/pedido) ya separa las dos pantallas, así que
  // acá arranca sin filtro de despacho en los dos modos. En Cotizaciones esto
  // además hace que una cotización cancelada sin confirmar no quede huérfana:
  // antes quedaba fija en shipping_status=borrador y esas nunca aparecían.
  const [shippingFilter, setShippingFilter] = useState<ShippingFilter>('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('')
  const [sinRepartidor, setSinRepartidor] = useState(false)
  // Chip de revisión: pedidos con alguna línea fuera de la lista de precios.
  const [soloExcepciones, setSoloExcepciones] = useState(false)
  // Período por defecto: último mes (evita cargar los ~1.5k pedidos del año).
  const [periodo, setPeriodo] = useState<string>('mes')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [data, setData] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [totalImporte, setTotalImporte] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [asignarPedidoId, setAsignarPedidoId] = useState<number | null>(null)
  const [pagoPedido, setPagoPedido] = useState<Pedido | null>(null)

  // Selección múltiple para cambios de estado masivos.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<string>('')
  // Borrado masivo. Confirmación en dos pasos dentro de la misma barra: borrar
  // no tiene vuelta atrás y no puede salir de un clic de más.
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkApplying, setBulkApplying] = useState(false)
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }, [])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('detalle')
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [nuevoShipping, setNuevoShipping] = useState<string>('')
  const [nuevoPago, setNuevoPago] = useState<string>('')
  const [savingEstado, setSavingEstado] = useState(false)
  // Estado de pago reactivado en el flujo de pedidos.
  const MOSTRAR_ESTADO_PAGO = true as boolean
  // Listado de pedidos activo (filtros + tabla + acciones).
  const PEDIDOS_LISTA_ENABLED = true as boolean
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingPedido, setDeletingPedido] = useState(false)
  const [transiciones, setTransiciones] = useState<{ shipping: Record<string, string[]>; payment: Record<string, string[]> }>({ shipping: {}, payment: {} })

  const debouncedSearch = useDebounce(search, 400)

  const fetchPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = {
        search: debouncedSearch,
        page,
        page_size: pageSize,
        sort_dir: sortDir,
      }
      if (sortBy) params.sort_by = sortBy
      if (shippingFilter) params.shipping_status = shippingFilter
      // Filtra por tipo_pedido, no por shipping_status: una cotización cancelada
      // sin confirmar sigue siendo cotización pase lo que pase con su despacho.
      params.tipo = esCotizaciones ? 'cotizacion' : 'pedido'
      if (paymentFilter) params.payment_status = paymentFilter
      if (sinRepartidor) params.sin_repartidor = true
      const { desde, hasta } = rangoDePeriodo(periodo)
      if (desde) params.fecha_desde = desde
      if (hasta) params.fecha_hasta = hasta
      // El chip de excepciones viaja por el mismo canal que los filtros de columna
      // (`tiene_excepcion_precio` está en el `allowed_columns` del backend), así no
      // hace falta un query param aparte.
      const filtros = soloExcepciones
        ? { ...columnFilters, tiene_excepcion_precio: 'true' }
        : columnFilters
      if (Object.keys(filtros).length > 0) params.filters = JSON.stringify(filtros)
      const res = await api.get<PaginatedResponse<Pedido> & { total_importe?: number }>('/pedidos', { params })
      setData(res.data.items)
      setTotal(res.data.total)
      if (res.data.total_importe != null) {
        setTotalImporte(res.data.total_importe)
      }
    } catch {
      toast.error('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, pageSize, shippingFilter, paymentFilter, sinRepartidor, soloExcepciones, periodo, columnFilters, sortBy, sortDir, esCotizaciones])

  useEffect(() => {
    fetchPedidos()
  }, [fetchPedidos])

  // Limpia la selección cuando cambia el conjunto (página/filtros).
  useEffect(() => { setSelectedIds(new Set()) }, [data])

  const selectAllPage = useCallback(() => {
    setSelectedIds((prev) => prev.size === data.length ? new Set() : new Set(data.map((p) => p.id)))
  }, [data])

  // Cambio de estado de despacho masivo (loop sobre la selección).
  const applyBulk = useCallback(async () => {
    if (!bulkStatus || selectedIds.size === 0) return
    setBulkApplying(true)
    let ok = 0, fail = 0
    // El motivo real del rechazo importa: confirmar cotizaciones en masa falla
    // por falta de stock, no por "transición inválida". Se guarda el primero para
    // que el usuario sepa qué corregir en vez de sólo cuántos se cayeron.
    let primerError: string | null = null
    for (const id of Array.from(selectedIds)) {
      try {
        await api.patch(`/pedidos/${id}/shipping-status`, { shipping_status: bulkStatus })
        ok++
      } catch (err) {
        fail++
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        if (primerError === null && typeof detail === 'string') primerError = detail
      }
    }
    setBulkApplying(false)
    const omitidos = fail
      ? `, ${fail} omitido${fail === 1 ? '' : 's'}${primerError ? `: ${primerError}` : ''}`
      : ''
    toast.success(`${ok} actualizado${ok === 1 ? '' : 's'}${omitidos}`)
    setBulkStatus('')
    clearSelection()
    fetchPedidos()
  }, [bulkStatus, selectedIds, clearSelection, fetchPedidos])

  // De lo seleccionado, qué se puede borrar realmente. El backend rechaza con 400
  // los pedidos que ya salieron de preparación, así que conviene decirlo ANTES y
  // no después de intentar 40 borrados.
  const seleccionEliminable = useMemo(
    () => data.filter((p) => selectedIds.has(p.id) && ESTADOS_ELIMINABLES.includes(p.shipping_status)),
    [data, selectedIds]
  )
  const seleccionNoEliminable = selectedIds.size - seleccionEliminable.length

  const deleteBulk = useCallback(async () => {
    if (seleccionEliminable.length === 0) return
    setBulkDeleting(true)
    let ok = 0
    let fail = 0
    let primerError: string | null = null
    for (const pedido of seleccionEliminable) {
      try {
        await api.delete(`/pedidos/${pedido.id}`)
        ok++
      } catch (err) {
        fail++
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        if (primerError === null && typeof detail === 'string') primerError = detail
      }
    }
    setBulkDeleting(false)
    setConfirmarBorrado(false)
    if (ok > 0) {
      toast.success(
        `${ok} ${ok === 1 ? 'eliminado' : 'eliminados'}. Se restauró el stock reservado.` +
        (fail ? ` ${fail} sin borrar${primerError ? `: ${primerError}` : ''}.` : '')
      )
    } else {
      toast.error(primerError || 'No se pudo eliminar ninguno')
    }
    clearSelection()
    fetchPedidos()
  }, [seleccionEliminable, clearSelection, fetchPedidos])

  // Si cambia la selección, se cae la confirmación pendiente: confirmar sobre una
  // selección distinta de la que se vio en pantalla sería borrar a ciegas.
  useEffect(() => {
    setConfirmarBorrado(false)
  }, [selectedIds])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, shippingFilter, paymentFilter, periodo, sinRepartidor, soloExcepciones])

  useEffect(() => {
    api.get('/pedidos/transiciones')
      .then(res => setTransiciones(res.data))
      .catch(() => console.error('Error al cargar transiciones de estado'))
  }, [])

  // Summary computations
  const totalPedidos = total
  const importeTotal = data.reduce((sum, p) => sum + p.importe_total, 0)
  const pendientesEntrega = data.filter(
    (p) => p.shipping_status !== 'entregado' && p.shipping_status !== 'cancelado'
  ).length
  const pendientesPago = data.filter(
    (p) => p.payment_status === 'pendiente' || p.payment_status === 'parcial'
  ).length

  // Últimos 18 meses como opciones del combo (ej. "Julio 2026").
  const mesesOptions = useMemo(() => {
    const arr: { value: string; label: string }[] = []
    const d = new Date()
    d.setDate(1)
    for (let i = 0; i < 18; i++) {
      arr.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`,
      })
      d.setMonth(d.getMonth() - 1)
    }
    return arr
  }, [])

  const handleExport = useCallback(async (format: string) => {
    try {
      const exportParams: Record<string, string> = {
        format,
        search: debouncedSearch,
      }
      if (shippingFilter) exportParams.shipping_status = shippingFilter
      exportParams.tipo = esCotizaciones ? 'cotizacion' : 'pedido'
      if (paymentFilter) exportParams.payment_status = paymentFilter

      if (format === 'json') {
        const res = await api.get('/exports/pedidos', { params: exportParams })
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'pedidos.json'
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      if (format === 'imprimir') {
        const res = await api.get('/exports/pedidos', {
          params: { ...exportParams, format: 'pdf' },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        return
      }
      const res = await api.get('/exports/pedidos', {
        params: exportParams,
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `pedidos.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    }
  }, [debouncedSearch, shippingFilter, paymentFilter, esCotizaciones])

  const openDetailModal = (pedido: Pedido) => {
    setSelectedPedido(pedido)
    setDetailTab('detalle')
    setShowDetailModal(true)
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedPedido(null)
    setDetailTab('detalle')
  }

  const openEstadoModal = (pedido: Pedido) => {
    setSelectedPedido(pedido)
    setNuevoShipping(pedido.shipping_status)
    setNuevoPago(pedido.payment_status)
    setShowEstadoModal(true)
  }

  const handleEstadoSave = async () => {
    if (!selectedPedido) return
    setSavingEstado(true)
    try {
      const promises: Promise<unknown>[] = []
      if (nuevoShipping !== selectedPedido.shipping_status) {
        promises.push(api.patch(`/pedidos/${selectedPedido.id}/shipping-status`, { shipping_status: nuevoShipping }))
      }
      if (nuevoPago !== selectedPedido.payment_status) {
        promises.push(api.patch(`/pedidos/${selectedPedido.id}/payment-status`, { payment_status: nuevoPago }))
      }
      if (promises.length === 0) {
        setShowEstadoModal(false)
        return
      }
      await Promise.all(promises)
      toast.success('Estado actualizado correctamente')
      setShowEstadoModal(false)
      setSelectedPedido(null)
      fetchPedidos()
    } catch {
      toast.error('Error al cambiar estado')
    } finally {
      setSavingEstado(false)
    }
  }

  const openDeleteModal = (pedido: Pedido) => {
    setSelectedPedido(pedido)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!selectedPedido) return
    setDeletingPedido(true)
    try {
      await api.delete(`/pedidos/${selectedPedido.id}`)
      toast.success(`Pedido ${selectedPedido.numero_pedido} eliminado correctamente. Stock restaurado.`)
      setShowDeleteModal(false)
      setSelectedPedido(null)
      fetchPedidos()
    } catch {
      toast.error('Error al eliminar el pedido')
    } finally {
      setDeletingPedido(false)
    }
  }

  const handleViewPdf = async (pedidoId: number, sinValores: boolean = false) => {
    try {
      const res = await api.get(`/pedidos/${pedidoId}/pdf`, {
        params: sinValores ? { sin_valores: true } : {},
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      const pdfWindow = window.open('', '_blank')
      if (pdfWindow) {
        // El remito de envío sale en tres copias: avisarlo en el título evita la
        // sorpresa de mandar a imprimir un trabajo de tres páginas.
        const copias = data.find((p) => p.id === pedidoId)?.modalidad_entrega === 'retira' ? '' : ' — 3 copias'
        pdfWindow.document.write(
          `<html><head><title>Pedido${sinValores ? ' (Sin Valores)' : ''}${copias}</title><style>body{margin:0}</style></head>` +
          `<body><iframe src="${blobUrl}" style="width:100%;height:100vh;border:none;"></iframe></body></html>`
        )
        pdfWindow.document.close()
      }
    } catch {
      toast.error('Error al generar el PDF del pedido')
    }
  }

  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'
  // Depósito reabre pedidos como parte de su trabajo; admin queda de respaldo.
  const puedeReabrir = isAdmin || user?.rol === 'operaciones'

  const columns = useMemo(() => [
    {
      key: '_sel',
      label: 'Sel',
      sortable: false,
      render: (_v: unknown, row: Pedido) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20 cursor-pointer"
        />
      ),
    },
    {
      key: 'numero_pedido',
      label: 'N\u00B0 Pedido',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string, row: Pedido) => (
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{value}</span>
          {row.sociedad && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-fit ${SOCIEDAD_BADGE[row.sociedad.toLowerCase()] || 'bg-gray-100 text-gray-600'
                }`}
            >
              {row.sociedad}
            </span>
          )}
          {row.tiene_excepcion_precio && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-fit bg-amber-100 text-amber-800"
              title={row.excepcion_precio_detalle || 'Tiene líneas con precio fuera de lista'}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              Excepción
            </span>
          )}
        </div>
      )
    },
    {
      key: 'cliente_nombre',
      label: 'Cliente',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'cliente_zona',
      label: 'Zona',
      sortable: false,
      render: (value: string | null) => (
        value ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#00AEEF]/10 text-[#0086c3] border border-[#00AEEF]/20">
            {value}
          </span>
        ) : <span className="text-gray-300">-</span>
      ),
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'vendedor_nombre',
      label: 'Vendedor',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'bultos',
      label: 'Bultos',
      sortable: true,
      render: (value: number) => value || 0,
    },
    {
      key: 'tipo_precio',
      label: 'Tipo Precio',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: GRUPO_OPTIONS,
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esGrupo(value) ? GRUPO_BADGE[value] : 'bg-gray-100 text-gray-600'
            }`}
        >
          {esGrupo(value) ? GRUPO_LABEL[value] : value || '-'}
        </span>
      ),
    },
    {
      key: 'tipo_cliente',
      label: 'Tipo Cliente',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: GRUPO_OPTIONS,
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esGrupo(value) ? GRUPO_BADGE[value] : 'bg-gray-100 text-gray-600'
            }`}
        >
          {esGrupo(value) ? GRUPO_LABEL[value] : value || '-'}
        </span>
      ),
    },
    {
      key: 'importe_total',
      label: 'Importe Total',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number, row: Pedido) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold">{formatCurrency(value)}
            {row.tipo_documento && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TIPO_DOC_BADGE[row.tipo_documento?.toLowerCase()] || 'bg-gray-100 text-gray-600'
                  }`}
              >
                {row.tipo_documento}
              </span>
            )}</span>
        </div>
      ),
    },
    {
      key: 'saldo_pendiente',
      label: 'Saldo Pendiente',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number, row: Pedido) => {
        const pagado = row.importe_total - value
        return (
          <div className="flex flex-col leading-tight">
            <span className={`font-semibold ${value > 0.009 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(value)}
            </span>
            {pagado > 0.009 && value > 0.009 && (
              <span className="text-[10px] text-gray-400">Pagado {formatCurrency(pagado)}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'shipping_status',
      label: 'Despacho',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'En Preparación', value: 'en_preparacion' },
        { label: 'Listo Despacho', value: 'listo_para_despacho' },
        { label: 'En Camino', value: 'en_camino' },
        { label: 'Entregado', value: 'entregado' },
        { label: 'Cancelado', value: 'cancelado' },
      ],
      render: (value: string, row: Pedido) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SHIPPING_BADGE[value] || 'bg-gray-100 text-gray-700'
              }`}
          >
            {SHIPPING_LABEL[value] || value}
          </span>
        </div>
      ),
    },
    {
      key: 'payment_status',
      label: 'Pago',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Parcial', value: 'parcial' },
        { label: 'Pagado', value: 'pagado' },
        { label: 'Cancelado', value: 'cancelado' },
      ],
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYMENT_BADGE[value] || 'bg-gray-100 text-gray-700'
            }`}
        >
          {PAYMENT_LABEL[value] || value}
        </span>
      ),
    },
    {
      key: 'repartidor_nombre',
      label: 'Repartidor',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'fecha_entrega',
      label: 'Fecha Entrega',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => (value ? formatDate(value) : '-'),
    },
    {
      key: 'transporte',
      label: 'Transporte',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'acciones',
      label: 'Acciones',
      sortable: false,
      stickyRight: true,
      render: (_value: unknown, row: Pedido) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openDetailModal(row)}
            className="p-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all hover:scale-105 active:scale-95"
            title="Ver Detalle"
          >
            <Eye className="w-4 h-4" />
          </button>

          <PedidoAccionesMenu
            pedido={row}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            onViewPdf={handleViewPdf}
            onEdit={() => window.open(`/dashboard/pedidos/${row.id}/editar`, '_blank')}
            onEstado={() => openEstadoModal(row)}
            onRegistrarPago={() => setPagoPedido(row)}
            onAsignar={() => setAsignarPedidoId(row.id)}
            onDelete={() => openDeleteModal(row)}
          />
        </div>
      ),
    },
  ], [router, isAdmin, user?.id, selectedIds, toggleSelect])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{copy.titulo}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{copy.bajada}</p>
          </div>
        </div>
        <button
          type="button"
          // Desde Cotizaciones hay que decirle a la pantalla de alta con qué
          // intención se abre: es lo que hace que el título, el botón de acción
          // y el destino al terminar sean los de una cotización y no los de un
          // pedido. Sin el query param, la misma ruta no tiene forma de saberlo
          // — el borrador que arma cualquiera de las dos es idéntico.
          onClick={() => router.push(esCotizaciones ? '/dashboard/pedidos/nuevo?modo=cotizacion' : '/dashboard/pedidos/nuevo')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003087] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002570] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{esCotizaciones ? 'Nueva Cotización' : 'Nuevo Pedido'}</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className={`grid grid-cols-1 gap-4 ${esCotizaciones ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        <StatCard title={esCotizaciones ? 'Total Cotizaciones' : 'Total Pedidos'} value={totalPedidos} icon={ClipboardList} color="blue" />
        <StatCard title="Importe Total" value={formatCurrency(importeTotal)} icon={DollarSign} color="green" />
        {!esCotizaciones && (
          <StatCard title="Pendientes Entrega" value={pendientesEntrega} icon={Truck} color="amber" />
        )}
      </div>

      {/* Lista (filtros + tabla): por ahora "Próximamente". Revivible: PEDIDOS_LISTA_ENABLED = true */}
      {!PEDIDOS_LISTA_ENABLED && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 py-20 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md shadow-black/10"
            style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
          >
            <Construction className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-gray-900">Próximamente</h2>
        </div>
      )}

      {PEDIDOS_LISTA_ENABLED && (<>
      {/* Período */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período</label>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] min-w-[180px]"
        >
          <option value="hoy">Hoy</option>
          <option value="semana">Última semana</option>
          <option value="mes">Último mes</option>
          <option value="todos">Todos</option>
          <optgroup label="Por mes">
            {mesesOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </optgroup>
        </select>
        {!loading && (
          <span className="text-xs text-gray-500">
            {total} {esCotizaciones ? 'cotización' : 'pedido'}{total === 1 ? '' : esCotizaciones ? 'es' : 's'} en el período
          </span>
        )}
      </div>

      {/* Filtros (más prolijos, en tarjeta) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 w-16 shrink-0">
            {esCotizaciones ? 'Estado' : 'Despacho'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(esCotizaciones ? COTIZACION_TABS : SHIPPING_TABS).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setShippingFilter(tab.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${shippingFilter === tab.value
                  ? 'bg-[#003087] text-white border-[#003087]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSinRepartidor((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${sinRepartidor
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                }`}
              title="Solo pedidos sin repartidor asignado"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sin repartidor
            </button>
            <button
              type="button"
              onClick={() => setSoloExcepciones((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${soloExcepciones
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                }`}
              title="Solo pedidos con alguna línea a un precio distinto del de lista"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Con excepción de precio
            </button>
          </div>
        </div>
        {MOSTRAR_ESTADO_PAGO && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-gray-50">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 w-16 shrink-0 pt-2 sm:pt-0">Pago</span>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPaymentFilter(tab.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${paymentFilter === tab.value
                    ? 'bg-[#E31837] text-white border-[#E31837]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barra de acciones masivas — se habilita al tildar */}
      {selectedIds.size > 0 && confirmarBorrado && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-900">
              ¿Eliminar {seleccionEliminable.length} {seleccionEliminable.length === 1 ? 'pedido' : 'pedidos'}?
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              No se puede deshacer. El stock que tenían reservado vuelve a estar disponible.
              {seleccionNoEliminable > 0 && (
                <>
                  {' '}<span className="font-semibold">
                    {seleccionNoEliminable} de los seleccionados no se {seleccionNoEliminable === 1 ? 'toca' : 'tocan'}
                  </span>: ya salieron de preparación y sólo se pueden cancelar.
                </>
              )}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmarBorrado(false)}
              disabled={bulkDeleting}
              className="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={deleteBulk}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {bulkDeleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Sí, eliminar
            </button>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && !confirmarBorrado && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#003087]/20 bg-[#003087]/5 px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-[#003087]">{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
          <button type="button" onClick={selectAllPage} className="text-xs font-medium text-[#003087] hover:underline">
            {selectedIds.size === data.length ? 'Quitar todos' : 'Seleccionar todos'}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-500">{esCotizaciones ? 'Cambiar a:' : 'Cambiar despacho a:'}</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20"
            >
              <option value="">Elegir estado…</option>
              {/* Desde una cotización lo único que se puede hacer en masa es
                  confirmarla o descartarla; el resto son estados de despacho. */}
              {(esCotizaciones
                ? ['pendiente', 'cancelado']
                : ['en_preparacion', 'listo_para_despacho', 'en_camino', 'entregado', 'cancelado']
              ).map((s) => (
                <option key={s} value={s}>
                  {s === 'pendiente' && esCotizaciones ? 'Confirmar (pasar a Pendiente)' : SHIPPING_LABEL[s] || s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulk}
              disabled={!bulkStatus || bulkApplying}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkApplying && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Aplicar
            </button>

            <span className="w-px h-6 bg-[#003087]/15" aria-hidden />

            <button
              type="button"
              onClick={() => setConfirmarBorrado(true)}
              disabled={seleccionEliminable.length === 0 || bulkApplying}
              title={
                seleccionEliminable.length === 0
                  ? 'Ninguno de los seleccionados se puede eliminar: ya salieron de preparación'
                  : `Eliminar ${seleccionEliminable.length} de ${selectedIds.size}`
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
              {seleccionEliminable.length > 0 && seleccionEliminable.length !== selectedIds.size && (
                <span className="px-1 py-px rounded bg-red-100 text-[10px] font-bold">
                  {seleccionEliminable.length}
                </span>
              )}
            </button>

            <button type="button" onClick={clearSelection} className="p-1.5 text-gray-400 hover:text-gray-600" title="Limpiar selección">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* DataGrid */}
      <DataGrid
        columns={columns}
        data={data}
        isLoading={loading}
        totalRows={total}
        page={page}
        pageSize={pageSize}
        searchValue={search}
        onSearch={setSearch}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSort={(key, dir) => { setSortBy(key); setSortDir(dir); setPage(1) }}
        onColumnFilter={(filters) => { setColumnFilters(filters); setPage(1) }}
        onExport={handleExport}
        searchPlaceholder="Buscar por N\u00B0 pedido, cliente..."
        storageKey="pedidos-grid-columns"
      />
      </>)}

      {/* Detail Modal */}
      {showDetailModal && selectedPedido && (() => {
        const p = selectedPedido
        const sem = p.semaforo ? SEMAFORO_INFO[p.semaforo] : null
        const totalUnidades = (p.items || []).reduce((s, it) => s + (Number(it.cantidad) || 0), 0)
        // Fila etiqueta/valor reutilizable (JSX, no componente).
        const campo = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
          <div className="flex items-start gap-2 py-1.5">
            {icon && <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
              <div className="text-sm text-gray-900 font-medium break-words">{value || <span className="text-gray-300">—</span>}</div>
            </div>
          </div>
        )
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-11 w-1.5 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087] shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-gray-900">Pedido {p.numero_pedido}</h2>
                      {p.sociedad && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${SOCIEDAD_BADGE[p.sociedad.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>{p.sociedad}</span>
                      )}
                      {p.tipo_documento && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${TIPO_DOC_BADGE[p.tipo_documento] || 'bg-gray-100 text-gray-600'}`}>{p.tipo_documento}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SHIPPING_BADGE[p.shipping_status] || ''}`}>
                        {SHIPPING_LABEL[p.shipping_status] || p.shipping_status}
                      </span>
                      {!p.reserva_stock && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800" title="Este pedido no comprometió mercadería">
                          No descuenta stock
                        </span>
                      )}
                      {MOSTRAR_ESTADO_PAGO && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYMENT_BADGE[p.payment_status] || ''}`}>
                          {PAYMENT_LABEL[p.payment_status] || p.payment_status}
                        </span>
                      )}
                      {sem && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${sem.text}`}>
                          <span className={`w-2 h-2 rounded-full ${sem.dot}`} /> {sem.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={closeDetailModal} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-3 -mb-3">
                {([
                  { value: 'detalle' as const, label: 'Detalle', icon: ListTree },
                  { value: 'bitacora' as const, label: 'Bitácora', icon: History },
                ]).map((tab) => {
                  const Icono = tab.icon
                  const activo = detailTab === tab.value
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setDetailTab(tab.value)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${activo
                        ? 'border-[#003087] text-[#003087]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}
                    >
                      <Icono className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {detailTab === 'bitacora' ? (
              <div className="p-6 overflow-y-auto">
                <BitacoraPedido pedidoId={p.id} />
              </div>
            ) : (
              <>
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Cliente y entrega */}
                    <section className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                        <MapPin className="w-4 h-4 text-[#003087]" /> Cliente y entrega
                      </h3>
                      <div className="divide-y divide-gray-100">
                        {campo('Cliente', (
                          <span className="flex items-center gap-2 flex-wrap">
                            {p.cliente_nombre || '-'}
                            {p.cliente_tipo && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{p.cliente_tipo}</span>}
                          </span>
                        ), <User className="w-3.5 h-3.5" />)}
                        {campo('Teléfono', p.cliente_telefono, <Phone className="w-3.5 h-3.5" />)}
                        {campo('Zona', p.cliente_zona && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#00AEEF]/10 text-[#0086c3] border border-[#00AEEF]/20">{p.cliente_zona}</span>
                        ))}
                        {campo('Localidad', p.cliente_localidad)}
                        {campo('Código postal', p.cliente_codigo_postal, <Hash className="w-3.5 h-3.5" />)}
                        {campo('Provincia', p.cliente_provincia)}
                        {campo('Domicilio', p.cliente_domicilio)}
                        {campo('Dirección de entrega', p.direccion_entrega)}
                        {campo('Transporte', p.transporte, <Truck className="w-3.5 h-3.5" />)}
                        {campo('Repartidor', p.repartidor_nombre)}
                        {campo('Fecha de entrega', p.fecha_entrega ? formatDate(p.fecha_entrega) : null, <Calendar className="w-3.5 h-3.5" />)}
                      </div>
                    </section>

                    {/* Comprobante */}
                    <section className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                        <FileText className="w-4 h-4 text-[#003087]" /> Comprobante
                      </h3>
                      <div className="divide-y divide-gray-100">
                        {campo('Fecha', formatDate(p.fecha), <Calendar className="w-3.5 h-3.5" />)}
                        {campo('Vendedor', p.vendedor_nombre, <User className="w-3.5 h-3.5" />)}
                        {campo('Tipo de precio', (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esGrupo(p.tipo_precio) ? GRUPO_BADGE[p.tipo_precio] : 'bg-gray-100 text-gray-600'}`}>
                            {esGrupo(p.tipo_precio) ? GRUPO_LABEL[p.tipo_precio] : p.tipo_precio || '-'}
                          </span>
                        ))}
                        {campo('Tipo de cliente', (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esGrupo(p.tipo_cliente) ? GRUPO_BADGE[p.tipo_cliente] : 'bg-gray-100 text-gray-600'}`}>
                            {esGrupo(p.tipo_cliente) ? GRUPO_LABEL[p.tipo_cliente] : p.tipo_cliente || '-'}
                          </span>
                        ))}
                        {p.tiene_excepcion_precio && campo('Excepción de precio', (
                          <span className="text-amber-700">{p.excepcion_precio_detalle || 'Sí'}</span>
                        ), <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />)}
                        {campo('Sociedad', p.sociedad && <span className="capitalize">{p.sociedad}</span>, <Building2 className="w-3.5 h-3.5" />)}
                        {campo('Bultos', p.bultos ? String(p.bultos) : '0', <Package className="w-3.5 h-3.5" />)}
                        {MOSTRAR_ESTADO_PAGO && campo('Compromiso de pago', p.fecha_compromiso_pago ? formatDate(p.fecha_compromiso_pago) : null, <CreditCard className="w-3.5 h-3.5" />)}
                        {campo('Despachado', p.despachado ? 'Sí' : 'No')}
                        {campo('Descuenta stock', p.reserva_stock
                          ? 'Sí'
                          : <span className="text-amber-700 font-medium">No — la mercadería no está comprometida</span>)}
                      </div>
                    </section>
                  </div>

                  {/* `forma_pago` es lo que carga ventas hoy. El plan multi-tramo
                      quedó sólo para los pedidos viejos que lo tengan; si hay uno,
                      se muestra ese porque es más detallado. */}
                  {!p.plan_pago?.length && p.forma_pago && (
                    <section className="rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">
                        Forma de pago
                      </h3>
                      <p className="text-sm text-gray-700 capitalize">{p.forma_pago}</p>
                    </section>
                  )}

                  {p.plan_pago?.length > 0 && (
                    <section className="rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">
                        Cómo paga
                      </h3>
                      <ul className="space-y-1">
                        {p.plan_pago.map((tramo, i) => (
                          <li key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              {tramo.forma}
                              {tramo.cuenta_nombre && (
                                <span className="text-gray-400"> → {tramo.cuenta_nombre}</span>
                              )}
                            </span>
                            <span className="font-semibold text-gray-900">{formatCurrency(tramo.importe)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {p.observacion && (
                    <section className="rounded-2xl border border-gray-100 bg-amber-50/40 p-4">
                      <h3 className="text-[11px] uppercase tracking-wide text-amber-700 font-bold mb-1">Observación</h3>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.observacion}</p>
                    </section>
                  )}

                  {/* Items */}
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                      <Package className="w-4 h-4 text-[#003087]" /> Ítems del pedido
                      <span className="text-xs font-normal text-gray-400">({(p.items || []).length})</span>
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                            <th className="px-4 py-2 text-left">Producto</th>
                            <th className="px-4 py-2 text-right">Cantidad</th>
                            <th className="px-4 py-2 text-right">Precio Unit.</th>
                            <th className="px-4 py-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items && p.items.length > 0 ? (
                            p.items.map((item, idx) => (
                              <tr key={item.id ?? idx} className="border-b border-gray-100 last:border-0">
                                <td className="px-4 py-2 text-gray-900">{item.producto_nombre || `Producto #${item.producto_id}`}</td>
                                <td className="px-4 py-2 text-right text-gray-700">
                                  <span className="inline-flex items-center gap-1.5 justify-end">
                                    {item.cantidad}
                                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full border ${item.unidad_venta === 'blister' ? 'text-[#00AEEF] bg-[#00AEEF]/10 border-[#00AEEF]/30' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                                      {item.unidad_venta === 'blister' ? 'Blíster' : 'Caja'}
                                    </span>
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(item.precio_unitario)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.precio_total)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin items</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer totales */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-xs text-gray-500">
                    {(p.items || []).length} ítem{(p.items || []).length === 1 ? '' : 's'} · {totalUnidades} unidad{totalUnidades === 1 ? '' : 'es'}{p.bultos ? ` · ${p.bultos} bulto${p.bultos === 1 ? '' : 's'}` : ''}
                  </div>
                  <div className="flex items-center gap-6">
                    {MOSTRAR_ESTADO_PAGO && (
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Saldo</p>
                        <p className={`text-sm font-bold ${p.saldo_pendiente > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(p.saldo_pendiente)}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Total</p>
                      <p className="text-lg font-black text-[#003087]">{formatCurrency(p.importe_total)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        )
      })()}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Eliminar Pedido
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedPedido(null)
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    ¿Estás seguro que deseas eliminar el pedido <strong>{selectedPedido.numero_pedido}</strong>?
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Esta acción eliminará el pedido y <strong>restaurará el stock reservado</strong> de todos los productos incluidos.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Importe: {formatCurrency(selectedPedido.importe_total)} — {selectedPedido.items?.length || 0} producto(s)
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSelectedPedido(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletingPedido}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deletingPedido ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado Change Modal */}
      {showEstadoModal && selectedPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Cambiar Estado - {selectedPedido.numero_pedido}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowEstadoModal(false)
                  setSelectedPedido(null)
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Shipping status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Despacho actual
                </label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SHIPPING_BADGE[selectedPedido.shipping_status] || ''
                    }`}
                >
                  {SHIPPING_LABEL[selectedPedido.shipping_status] || selectedPedido.shipping_status}
                </span>
              </div>
              <div>
                <label htmlFor="nuevo-shipping" className="block text-sm font-medium text-gray-700 mb-1">
                  Nuevo estado de despacho
                </label>
                <select
                  id="nuevo-shipping"
                  value={nuevoShipping}
                  onChange={(e) => setNuevoShipping(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                >
                  <option value={selectedPedido.shipping_status}>
                    {SHIPPING_LABEL[selectedPedido.shipping_status] || selectedPedido.shipping_status} (sin cambio)
                  </option>
                  {(transiciones.shipping[selectedPedido.shipping_status] || [])
                    // Devolver a "pendiente" reabre el pedido para editarlo: solo
                    // depósito y admin pueden, así que a ventas ni se le ofrece.
                    .filter((s) => s !== 'pendiente' || puedeReabrir)
                    .map((s) => (
                      <option key={s} value={s}>{SHIPPING_LABEL[s] || s}</option>
                    ))}
                </select>
              </div>

              {/* OCULTO (revivir): estado de pago en el modal — pedidos sin pagos */}
              {MOSTRAR_ESTADO_PAGO && (<>
              {/* Payment status */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pago actual
                </label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYMENT_BADGE[selectedPedido.payment_status] || ''
                    }`}
                >
                  {PAYMENT_LABEL[selectedPedido.payment_status] || selectedPedido.payment_status}
                </span>
              </div>
              <div>
                <label htmlFor="nuevo-pago" className="block text-sm font-medium text-gray-700 mb-1">
                  Nuevo estado de pago
                </label>
                <select
                  id="nuevo-pago"
                  value={nuevoPago}
                  onChange={(e) => setNuevoPago(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                >
                  <option value={selectedPedido.payment_status}>
                    {PAYMENT_LABEL[selectedPedido.payment_status] || selectedPedido.payment_status} (sin cambio)
                  </option>
                  {(transiciones.payment[selectedPedido.payment_status] || []).map((s) => (
                    <option key={s} value={s}>{PAYMENT_LABEL[s] || s}</option>
                  ))}
                </select>
              </div>
              </>)}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEstadoModal(false)
                    setSelectedPedido(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEstadoSave}
                  disabled={savingEstado}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50 transition-colors"
                >
                  {savingEstado ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AsignarRepartidorModal
        pedidoId={asignarPedidoId ?? 0}
        isOpen={asignarPedidoId !== null}
        onClose={() => setAsignarPedidoId(null)}
        onSuccess={() => { setAsignarPedidoId(null); fetchPedidos() }}
      />

      <RegistrarPagoPedidoModal
        pedido={pagoPedido}
        open={pagoPedido !== null}
        onClose={() => setPagoPedido(null)}
        onSuccess={fetchPedidos}
      />
    </div>
  )
}
