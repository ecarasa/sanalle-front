'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, Edit, X, ClipboardList, Truck, DollarSign, Trash2, FileText, ChevronDown, CreditCard, Plus, History, ListTree, Construction } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import StatCard from '@/components/dashboard/StatCard'
import BitacoraPedido from '@/components/pedidos/BitacoraPedido'
import { GRUPO_BADGE, GRUPO_LABEL, GRUPO_OPTIONS, esGrupo } from '@/lib/listas'
import { Pedido, PaginatedResponse } from '@/types'

type DetailTab = 'detalle' | 'bitacora'

type ShippingFilter = '' | 'pendiente' | 'en_preparacion' | 'listo_para_despacho' | 'en_camino' | 'entregado' | 'cancelado'
type PaymentFilter = '' | 'pendiente' | 'pagado' | 'parcial' | 'cancelado'

const SHIPPING_TABS: { label: string; value: ShippingFilter }[] = [
  { label: 'Todos', value: '' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'En Preparación', value: 'en_preparacion' },
  { label: 'Listo Despacho', value: 'listo_para_despacho' },
  { label: 'En Camino', value: 'en_camino' },
  { label: 'Entregado', value: 'entregado' },
  { label: 'Cancelado', value: 'cancelado' },
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

const SOCIEDAD_BADGE: Record<string, string> = {
  sanalle: 'bg-blue-600 text-white',
  farmacare: 'bg-red-600 text-white',
}

function PedidoPdfDropdown({ pedidoId, onViewPdf }: { pedidoId: number; onViewPdf: (id: number, sinValores: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center relative"
        title="Generar PDF del Pedido"
      >
        <FileText className="w-4 h-4" />
        <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full">
          <ChevronDown className="w-2.5 h-2.5" />
        </div>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <button
            type="button"
            onClick={() => { onViewPdf(pedidoId, false); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors border-b border-gray-50 last:border-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Con valores
          </button>
          <button
            type="button"
            onClick={() => { onViewPdf(pedidoId, true); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            Sin valores
          </button>
        </div>
      )}
    </div>
  )
}

export default function PedidosPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [shippingFilter, setShippingFilter] = useState<ShippingFilter>('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('')
  // Período por defecto: último mes (evita cargar los ~1.5k pedidos del año).
  const [periodo, setPeriodo] = useState<string>('mes')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [data, setData] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [totalImporte, setTotalImporte] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('detalle')
  const [showEstadoModal, setShowEstadoModal] = useState(false)
  const [nuevoShipping, setNuevoShipping] = useState<string>('')
  const [nuevoPago, setNuevoPago] = useState<string>('')
  const [savingEstado, setSavingEstado] = useState(false)
  // Pedidos sin pagos: oculta el estado de pago en el modal (revivible: true).
  const MOSTRAR_ESTADO_PAGO = false as boolean
  // Lista de pedidos: por ahora solo contadores; filtros+tabla → "Próximamente" (revivible: true).
  const PEDIDOS_LISTA_ENABLED = false as boolean
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingPedido, setDeletingPedido] = useState(false)
  const [transiciones, setTransiciones] = useState<{ shipping: Record<string, string[]>; payment: Record<string, string[]> }>({ shipping: {}, payment: {} })

  const debouncedSearch = useDebounce(search, 400)

  const fetchPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        search: debouncedSearch,
        page,
        page_size: pageSize,
        sort_dir: sortDir,
      }
      if (sortBy) params.sort_by = sortBy
      if (shippingFilter) params.shipping_status = shippingFilter
      if (paymentFilter) params.payment_status = paymentFilter
      const { desde, hasta } = rangoDePeriodo(periodo)
      if (desde) params.fecha_desde = desde
      if (hasta) params.fecha_hasta = hasta
      if (Object.keys(columnFilters).length > 0) params.filters = JSON.stringify(columnFilters)
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
  }, [debouncedSearch, page, pageSize, shippingFilter, paymentFilter, periodo, columnFilters, sortBy, sortDir])

  useEffect(() => {
    fetchPedidos()
  }, [fetchPedidos])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, shippingFilter, paymentFilter, periodo])

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
  }, [debouncedSearch, shippingFilter, paymentFilter])

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
        pdfWindow.document.write(
          `<html><head><title>Pedido${sinValores ? ' (Sin Valores)' : ''}</title><style>body{margin:0}</style></head>` +
          `<body><iframe src="${blobUrl}" style="width:100%;height:100vh;border:none;"></iframe></body></html>`
        )
        pdfWindow.document.close()
      }
    } catch {
      toast.error('Error al generar el PDF del pedido')
    }
  }

  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'

  const columns = useMemo(() => [
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
    /* --- OCULTO (revivir): columna Pago — pedidos sin pagos. Ver docs/OCULTO_PARA_REVIVIR.md ---
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
    --- FIN OCULTO --- */
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
    /* --- OCULTO (revivir): columna Saldo — pedidos sin pagos. ---
    {
      key: 'saldo_pendiente',
      label: 'Saldo',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(value)}
        </span>
      ),
    },
    --- FIN OCULTO --- */
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

          <PedidoPdfDropdown pedidoId={row.id} onViewPdf={handleViewPdf} />

          {row.shipping_status !== 'entregado' && row.shipping_status !== 'cancelado' && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/pedidos/${row.id}/editar`)}
              className="p-2 text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-all hover:scale-105 active:scale-95"
              title="Editar Pedido"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => openEstadoModal(row)}
            className="p-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-all hover:scale-105 active:scale-95"
            title="Cambiar Estado"
          >
            <Truck className="w-4 h-4" />
          </button>

          {(row.shipping_status === 'pendiente' || row.shipping_status === 'en_preparacion') && (
            <button
              type="button"
              onClick={() => openDeleteModal(row)}
              className="p-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-all hover:scale-105 active:scale-95"
              title="Eliminar Pedido"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ], [router, isAdmin])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pedidos</h1>
            <p className="mt-0.5 text-sm text-gray-500">Gestiona los pedidos de venta</p>
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Próximamente"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Pedido</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Pedidos" value={totalPedidos} icon={ClipboardList} color="blue" />
        <StatCard title="Importe Total" value={formatCurrency(importeTotal)} icon={DollarSign} color="green" />
        <StatCard title="Pendientes Entrega" value={pendientesEntrega} icon={Truck} color="amber" />
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
            {total} pedido{total === 1 ? '' : 's'} en el período
          </span>
        )}
      </div>

      {/* Despacho filter tabs */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Despacho</p>
        <div className="flex flex-wrap gap-2">
          {SHIPPING_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setShippingFilter(tab.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${shippingFilter === tab.value
                ? 'bg-[#003087] text-white border-[#003087]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* OCULTO (revivir): filtro por estado de Pago — pedidos sin pagos */}
        {MOSTRAR_ESTADO_PAGO && (<>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-1">Pago</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPaymentFilter(tab.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${paymentFilter === tab.value
                ? 'bg-[#E31837] text-white border-[#E31837]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        </>)}
      </div>

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
      {showDetailModal && selectedPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Detalle del Pedido {selectedPedido.numero_pedido}
              </h2>
              <button
                type="button"
                onClick={closeDetailModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-gray-100">
              <div className="flex gap-1">
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
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                        }`}
                    >
                      <Icono className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {detailTab === 'bitacora' && (
              <div className="p-6">
                <BitacoraPedido pedidoId={selectedPedido.id} />
              </div>
            )}

            {detailTab === 'detalle' && (
            <div className="p-6 space-y-6">
              {/* Pedido info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">
                    {selectedPedido.cliente_nombre || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Vendedor</p>
                  <p className="font-medium text-gray-900">
                    {selectedPedido.vendedor_nombre || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Tipo de Precio</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esGrupo(selectedPedido.tipo_precio) ? GRUPO_BADGE[selectedPedido.tipo_precio] : 'bg-gray-100 text-gray-600'
                      }`}
                  >
                    {esGrupo(selectedPedido.tipo_precio) ? GRUPO_LABEL[selectedPedido.tipo_precio] : selectedPedido.tipo_precio || '-'}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Despacho</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SHIPPING_BADGE[selectedPedido.shipping_status] || ''
                      }`}
                  >
                    {SHIPPING_LABEL[selectedPedido.shipping_status] || selectedPedido.shipping_status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Pago</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYMENT_BADGE[selectedPedido.payment_status] || ''
                      }`}
                  >
                    {PAYMENT_LABEL[selectedPedido.payment_status] || selectedPedido.payment_status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Fecha</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(selectedPedido.fecha)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Fecha Entrega</p>
                  <p className="font-medium text-gray-900">
                    {selectedPedido.fecha_entrega
                      ? formatDate(selectedPedido.fecha_entrega)
                      : '-'}
                  </p>
                </div>
                {selectedPedido.transporte && (
                  <div>
                    <p className="text-gray-500">Transporte</p>
                    <p className="font-medium text-gray-900">{selectedPedido.transporte}</p>
                  </div>
                )}
                {selectedPedido.sociedad && (
                  <div>
                    <p className="text-gray-500">Sociedad</p>
                    <p className="font-medium text-gray-900 capitalize">{selectedPedido.sociedad}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Despachado</p>
                  <p className="font-medium text-gray-900">{selectedPedido.despachado ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Importe Total</p>
                  <p className="font-bold text-gray-900">
                    {formatCurrency(selectedPedido.importe_total)}
                  </p>
                </div>
                {selectedPedido.observacion && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-gray-500">Observaci&oacute;n</p>
                    <p className="font-medium text-gray-900">
                      {selectedPedido.observacion}
                    </p>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Items del Pedido
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                          Producto
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                          Cantidad
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                          Precio Unit.
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                          Precio Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPedido.items && selectedPedido.items.length > 0 ? (
                        selectedPedido.items.map((item, idx) => (
                          <tr
                            key={item.id ?? idx}
                            className="border-b border-gray-100"
                          >
                            <td className="px-4 py-2 text-gray-900">
                              {item.producto_nombre || `Producto #${item.producto_id}`}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {item.cantidad}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {formatCurrency(item.precio_unitario)}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                              {formatCurrency(item.precio_total)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-6 text-center text-gray-400"
                          >
                            Sin items
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

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
                  {(transiciones.shipping[selectedPedido.shipping_status] || []).map((s) => (
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
    </div>
  )
}
