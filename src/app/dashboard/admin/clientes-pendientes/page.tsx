'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CheckCircle, XCircle, Loader2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import { ClienteConDeuda, PaginatedResponse } from '@/types'
import { formatDate } from '@/lib/utils'

export default function ClientesPendientesPage() {
  useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<ClienteConDeuda[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchPendientes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<ClienteConDeuda>>('/clientes/pendientes', {
        params: { search, page, page_size: pageSize },
      })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar clientes pendientes')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize])

  useEffect(() => {
    fetchPendientes()
  }, [fetchPendientes])

  const handleAprobar = async (clienteId: number) => {
    setActionLoading(clienteId)
    try {
      await api.patch(`/clientes/${clienteId}/aprobar`)
      toast.success('Cliente aprobado correctamente')
      fetchPendientes()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al aprobar cliente')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRechazar = async (clienteId: number) => {
    setActionLoading(clienteId)
    try {
      await api.delete(`/clientes/${clienteId}`)
      toast.success('Cliente rechazado y eliminado')
      fetchPendientes()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al rechazar cliente')
    } finally {
      setActionLoading(null)
    }
  }

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'cuit',
      label: 'CUIT',
      sortable: false,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'vendedor_nombre',
      label: 'Vendedor',
      sortable: false,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'localidad',
      label: 'Localidad',
      sortable: true,
    },
    {
      key: 'created_at',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      stickyRight: true,
      sortable: false,
      render: (_value: unknown, row: ClienteConDeuda) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleAprobar(row.id)}
            disabled={actionLoading === row.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            title="Aprobar"
          >
            {actionLoading === row.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Aprobar
          </button>
          <button
            type="button"
            onClick={() => handleRechazar(row.id)}
            disabled={actionLoading === row.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            title="Rechazar"
          >
            {actionLoading === row.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Rechazar
          </button>
        </div>
      ),
    },
  ], [actionLoading])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <UserCheck className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clientes Pendientes</h1>
            <p className="text-sm text-gray-500 mt-1">Clientes que requieren aprobacion para operar</p>
          </div>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700 self-start sm:self-auto">
            {total} pendiente{total !== 1 ? 's' : ''}
          </span>
        )}
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
        searchPlaceholder="Buscar por nombre, CUIT..."
        storageKey="admin-clientes-pendientes-grid"
      />
    </div>
  )
}
