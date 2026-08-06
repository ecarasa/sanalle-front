'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import DataGrid from '@/components/grilla/DataGrid'
import { PaginatedResponse } from '@/types'

interface PagosPorPedidoRow {
  c_nombre: string
  a_idpedido: number
  pe_fecha: string
  pe_fechaentrega: string | null
  pe_importetotal: number
  a_idpago: number
  pa_receptor: string | null
  tp_nombre: string
  pa_fecharecep: string
  pa_chbanco: string | null
  pa_chvto: string | null
  a_importe: number
  a_saldo: number
}

const TIPO_PAGO_BADGE: Record<string, string> = {
  Efectivo: 'bg-green-100 text-green-700',
  Cheque: 'bg-yellow-100 text-yellow-700',
  Transferencia: 'bg-blue-100 text-blue-700',
  'Retenci\u00f3n': 'bg-gray-100 text-gray-700',
}

export default function PagosPorPedidoReportePage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<PagosPorPedidoRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoPago, setTipoPago] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (tipoPago) params.tipo_pago = tipoPago
      if (fechaDesde) params.fecha_desde = fechaDesde
      if (fechaHasta) params.fecha_hasta = fechaHasta

      const res = await api.get<PaginatedResponse<PagosPorPedidoRow>>('/reportes/pagos-por-pedido', { params })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar reporte')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, tipoPago, fechaDesde, fechaHasta])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, tipoPago, fechaDesde, fechaHasta])

  // Export handler
  const handleExport = useCallback(async (format: string) => {
    try {
      const params: Record<string, string> = { format }
      if (debouncedSearch) params.search = debouncedSearch
      if (tipoPago) params.tipo_pago = tipoPago
      if (fechaDesde) params.fecha_desde = fechaDesde
      if (fechaHasta) params.fecha_hasta = fechaHasta

      if (format === 'json') {
        const res = await api.get('/reportes/pagos-por-pedido/export', { params })
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'pagos_por_pedido.json'
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      if (format === 'imprimir') {
        const res = await api.get('/reportes/pagos-por-pedido/export', {
          params: { ...params, format: 'pdf' },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        return
      }
      const res = await api.get('/reportes/pagos-por-pedido/export', {
        params,
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `pagos_por_pedido.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    }
  }, [debouncedSearch, tipoPago, fechaDesde, fechaHasta])

  const columns = useMemo(() => [
    {
      key: 'c_nombre',
      label: 'Cliente',
      sortable: true,
    },
    {
      key: 'a_idpedido',
      label: 'ID Pedido',
      sortable: true,
      render: (value: number) => (
        <a
          href={`/dashboard/pedidos/${value}/editar`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#003087] hover:text-[#00AEEF] font-medium underline underline-offset-2"
        >
          #{value}
        </a>
      ),
    },
    {
      key: 'pe_fecha',
      label: 'Fecha Pedido',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'pe_fechaentrega',
      label: 'Fecha Entrega',
      sortable: true,
      render: (value: string | null) => (value ? formatDate(value) : '-'),
    },
    {
      key: 'pe_importetotal',
      label: 'Importe Pedido',
      sortable: true,
      render: (value: number) => (
        <span className="font-semibold">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'a_idpago',
      label: 'ID Pago',
      sortable: true,
    },
    {
      key: 'pa_receptor',
      label: 'Receptor',
      sortable: true,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'tp_nombre',
      label: 'Tipo Pago',
      sortable: true,
      render: (value: string) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            TIPO_PAGO_BADGE[value] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'pa_fecharecep',
      label: 'Fecha Recep.',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'pa_chbanco',
      label: 'Banco',
      sortable: false,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'pa_chvto',
      label: 'Vto Cheque',
      sortable: false,
      render: (value: string | null) => (value ? formatDate(value) : '-'),
    },
    {
      key: 'a_importe',
      label: 'Importe Pago',
      sortable: true,
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'a_saldo',
      label: 'Saldo',
      sortable: true,
      render: (value: number) => (
        <span className={`font-semibold ${value <= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(value)}
        </span>
      ),
    },
  ], [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pagos por Pedido</h1>
        <p className="text-sm text-gray-500 mt-1">Detalle de pagos asociados a cada pedido</p>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
          </div>

          {/* Tipo pago select */}
          <select
            value={tipoPago}
            onChange={(e) => setTipoPago(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
          >
            <option value="">Todos los tipos</option>
            <option value="efectivo">Efectivo</option>
            <option value="cheque">Cheque</option>
            <option value="transferencia">Transferencia</option>
            <option value="retencion">Retenci&oacute;n</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            placeholder="Desde"
            title="Fecha desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            placeholder="Hasta"
            title="Fecha hasta"
          />
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <DataGrid
          columns={columns}
          data={data}
          isLoading={loading}
          totalRows={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onExport={handleExport}
          storageKey="reportes-pagos-pedido-grid"
        />
      </div>
    </div>
  )
}
