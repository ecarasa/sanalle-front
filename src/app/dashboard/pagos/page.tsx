'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Search, FileText, X, Loader2, ChevronDown, ExternalLink, Info, CheckCircle, Edit, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import { Pago, Cliente, PaginatedResponse } from '@/types'
import ImputarPagoModal from '@/components/dashboard/pagos/ImputarPagoModal'
import ModificarPagoModal from '@/components/dashboard/pagos/ModificarPagoModal'
import DetallePagoDrawer from '@/components/dashboard/pagos/DetallePagoDrawer'
import ClientSelector from '@/components/ui/ClientSelector'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

const TIPO_PAGO_BADGE: Record<string, string> = {
  efectivo: 'bg-green-100 text-green-700',
  cheque: 'bg-yellow-100 text-yellow-700',
  transferencia: 'bg-blue-100 text-blue-700',
  retencion: 'bg-gray-100 text-gray-700',
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  recibido: 'bg-amber-100 text-amber-700',
  acreditado: 'bg-green-100 text-green-700',
  imputado: 'bg-emerald-100 text-emerald-700',
  imputado_parcial: 'bg-teal-100 text-teal-700',
  rechazado: 'bg-red-100 text-red-700',
}

function ReciboDropdown({ pagoId, onViewRecibo }: { pagoId: number; onViewRecibo: (id: number, sinValores: boolean) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20"
          title="Ver Recibo PDF"
        >
          <FileText className="w-3.5 h-3.5" />
          PDF
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[9999] w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
        >
          <DropdownMenu.Item
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer outline-none focus:bg-gray-50"
            onClick={() => onViewRecibo(pagoId, false)}
          >
            <FileText className="w-3.5 h-3.5 text-green-600" />
            Con valores
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer outline-none focus:bg-gray-50"
          >
            <button
              type="button"
              className="flex items-center gap-2 w-full outline-none"
              onClick={() => onViewRecibo(pagoId, true)}
            >
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              Sin valores
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export default function PagosPage() {
  const { user, isLoading: authLoading } = useAuth()

  // Client panel state
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'

  // Pagos state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<Pago[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [showClientPanel, setShowClientPanel] = useState(false)
  const [imputarPago, setImputarPago] = useState<Pago | null>(null)

  // Edit Pago State
  const [editPago, setEditPago] = useState<Pago | null>(null)

  // Detalle drawer state
  const [detallePago, setDetallePago] = useState<Pago | null>(null)


  // Fetch pagos
  const fetchPagos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
        sort_dir: sortDir,
      }
      if (sortBy) params.sort_by = sortBy
      if (selectedClienteId) {
        params.cliente_id = selectedClienteId
      }
      if (Object.keys(columnFilters).length > 0) {
        params.filters = JSON.stringify(columnFilters)
      }
      const res = await api.get<PaginatedResponse<Pago>>('/pagos', { params })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar pagos')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, selectedClienteId, columnFilters, sortBy, sortDir])

  useEffect(() => {
    fetchPagos()
  }, [fetchPagos])

  // Reset page when client selection changes
  useEffect(() => {
    setPage(1)
  }, [selectedClienteId])



  const handeModalSuccess = () => {
    fetchPagos()
  }

  const handleViewRecibo = async (pagoId: number, sinValores: boolean = false) => {
    try {
      const res = await api.get(`/pagos/${pagoId}/recibo`, {
        params: sinValores ? { sin_valores: true } : {},
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      const pdfWindow = window.open('', '_blank')
      if (pdfWindow) {
        pdfWindow.document.write(
          `<html><head><title>Recibo${sinValores ? ' (Sin Valores)' : ''}</title><style>body{margin:0}</style></head>` +
          `<body><iframe src="${blobUrl}" style="width:100%;height:100vh;border:none;"></iframe></body></html>`
        )
        pdfWindow.document.close()
      }
    } catch {
      toast.error('Error al abrir el recibo')
    }
  }

  const handleExport = useCallback(async (format: string) => {
    try {
      const params: Record<string, string | number | undefined> = {
        format,
        cliente_id: selectedClienteId || undefined,
      }
      if (format === 'json') {
        const res = await api.get('/exports/pagos', { params })
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'pagos.json'
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      if (format === 'imprimir') {
        const res = await api.get('/exports/pagos', {
          params: { ...params, format: 'pdf' },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        return
      }
      const res = await api.get('/exports/pagos', {
        params,
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `pagos.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    }
  }, [selectedClienteId])


  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
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
      key: 'tipo_pago',
      label: 'Tipo Pago',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [{ label: 'Efectivo', value: 'efectivo' }, { label: 'Cheque', value: 'cheque' }, { label: 'Transferencia', value: 'transferencia' }, { label: 'Retencion', value: 'retencion' }],
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${TIPO_PAGO_BADGE[value] || 'bg-gray-100 text-gray-700'
            }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'fecha_recepcion',
      label: 'Fecha Recep.',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'importe',
      label: 'Importe',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number) => (
        <span className="font-semibold">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'saldo_restante',
      label: 'Saldo Rest.',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'receptor_nombre',
      label: 'Receptor',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Recibido', value: 'recibido' },
        { label: 'Imputado Parcial', value: 'imputado_parcial' },
        { label: 'Imputado', value: 'imputado' },
        { label: 'Acreditado', value: 'acreditado' },
        { label: 'Rechazado', value: 'rechazado' }
      ],
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${ESTADO_BADGE[value] || 'bg-gray-100 text-gray-700'
            }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'ch_numero',
      label: 'Ch Nro',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'ch_banco',
      label: 'Ch Banco',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'ch_fecha',
      label: 'Ch Fecha',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => (value ? formatDate(value) : '-'),
    },
    {
      key: 'ch_vto',
      label: 'Ch Vto',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => (value ? formatDate(value) : '-'),
    },
    ...(isAdmin ? [{
      key: 'acciones',
      label: 'Acciones',
      stickyRight: true,
      sortable: false,
      render: (_value: unknown, row: Pago) => (
        <div className="flex items-center gap-1.5">
          {row.recibo_pdf_path ? (
            <ReciboDropdown
              pagoId={row.id}
              onViewRecibo={handleViewRecibo}
            />
          ) : (
            <span className="w-8 flex justify-center text-gray-400 text-xs">-</span>
          )}
          <button
            type="button"
            onClick={() => setDetallePago(row)}
            className="p-2 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all hover:scale-105 active:scale-95"
            title="Ver destino del pago"
          >
            <Info className="w-4 h-4" />
          </button>
          {(row.estado === 'recibido' || row.estado === 'imputado_parcial') && (
            <button
              type="button"
              onClick={() => setImputarPago(row)}
              className="p-2 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all hover:scale-105 active:scale-95"
              title="Imputar Pago"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {
            isAdmin && (
              <Link href="/dashboard/admin/proveedores"
                className="p-2 inline-flex text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all hover:scale-105 active:scale-95"
                title="Pagar Deuda"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )
          }

          <button
            type="button"
            onClick={() => setEditPago(row)}
            className="p-2 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all hover:scale-105 active:scale-95"
            title="Modificar Estado"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      ),
    }] : []),
  ], [isAdmin])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gesti&oacute;n de pagos y cobranzas
          </p>
        </div>
        <Link
          href="/dashboard/pagos/nuevo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Pago</span>
        </Link>
      </div>

      {/* Grid container taking full width */}
      <div className="flex gap-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ minHeight: '70vh' }}>
        {/* Main panel - Pagos */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-col gap-4 p-4 sm:p-5 border-b border-gray-100 bg-gray-50/30">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {selectedCliente ? selectedCliente.nombre : 'Todos los pagos'}
              </h2>
            </div>

            {/* Protagonist Client Search */}
            <ClientSelector
              selectedClienteId={selectedClienteId}
              onClientSelect={(id, cliente) => {
                setSelectedClienteId(id)
                setSelectedCliente(cliente || null)
              }}
            />
          </div>
          <div className="flex-1 overflow-auto">
            {authLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#003087]" />
              </div>
            ) : (
              <DataGrid
                columns={columns}
                data={data}
                isLoading={loading}
                totalRows={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onSort={(key, dir) => { setSortBy(key); setSortDir(dir); setPage(1) }}
                onExport={handleExport}
                onColumnFilter={(filters) => { setColumnFilters(filters); setPage(1) }}
                storageKey="pagos-grid-columns"
              />
            )}
          </div>
        </div>
      </div>
      <ImputarPagoModal
        isOpen={!!imputarPago}
        onClose={() => setImputarPago(null)}
        onSuccess={handeModalSuccess}
        pago={imputarPago}
        session={user}
        tipo_pago={imputarPago?.tipo_pago || ''}
      />

      <ModificarPagoModal
        isOpen={!!editPago}
        onClose={() => setEditPago(null)}
        onSuccess={handeModalSuccess}
        pago={editPago}
      />

      <DetallePagoDrawer
        isOpen={!!detallePago}
        pago={detallePago}
        onClose={() => setDetallePago(null)}
      />
    </div>
  )
}
