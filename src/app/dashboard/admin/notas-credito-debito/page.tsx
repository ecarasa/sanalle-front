'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import { NotaCreditoDebito, PaginatedResponse } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function NotasCreditoDebitoPage() {
  useAuth()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [data, setData] = useState<NotaCreditoDebito[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotas = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { search, page, page_size: pageSize }
      if (Object.keys(columnFilters).length > 0) {
        params.filters = JSON.stringify(columnFilters)
      }
      const res = await api.get<PaginatedResponse<NotaCreditoDebito>>('/notas-credito-debito', { params })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar notas')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, columnFilters])

  useEffect(() => {
    fetchNotas()
  }, [fetchNotas])

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'numero',
      label: 'Numero',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [
        { label: 'Credito', value: 'credito' },
        { label: 'Debito', value: 'debito' },
      ],
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'credito' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {value === 'credito' ? 'NC' : 'ND'}
        </span>
      ),
    },
    {
      key: 'cliente_nombre',
      label: 'Cliente',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'importe_total',
      label: 'Importe Total',
      sortable: true,
      render: (value: number) => (
        <span className="font-semibold">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'motivo',
      label: 'Motivo',
      sortable: false,
      render: (value: string | null) => (
        <span className="text-gray-500 truncate max-w-[200px] block">{value || '-'}</span>
      ),
    },
    {
      key: 'creado_por_nombre',
      label: 'Creado por',
      sortable: false,
      render: (value: string | null) => value || '-',
    },
  ], [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#003087]/10">
            <FileText className="w-6 h-6 text-[#003087]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notas de Credito / Debito</h1>
            <p className="text-sm text-gray-500 mt-1">Gestiona notas de credito y debito</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => router.push('/dashboard/admin/notas-credito-debito/nueva?tipo=credito')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nota de Credito</span>
            <span className="sm:hidden">NC</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/admin/notas-credito-debito/nueva?tipo=debito')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#E31837] rounded-lg hover:bg-[#c41530] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nota de Debito</span>
            <span className="sm:hidden">ND</span>
          </button>
        </div>
      </div>

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
        onColumnFilter={(filters) => { setColumnFilters(filters); setPage(1) }}
        searchPlaceholder="Buscar por numero, cliente, motivo..."
        storageKey="admin-notas-cd-grid"
      />
    </div>
  )
}
