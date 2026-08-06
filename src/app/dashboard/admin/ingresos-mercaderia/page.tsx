'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Package, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import IngresoDetalleModal from '@/components/admin/IngresoDetalleModal'
import { IngresoMercaderia, PaginatedResponse } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function IngresosMercaderiaPage() {
  useAuth()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<IngresoMercaderia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detalleIngreso, setDetalleIngreso] = useState<IngresoMercaderia | null>(null)

  const fetchIngresos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<IngresoMercaderia>>('/ingresos-mercaderia', {
        params: { search, page, page_size: pageSize },
      })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar registros de compra')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize])

  useEffect(() => {
    fetchIngresos()
  }, [fetchIngresos])

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'numero',
      label: 'Número',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'numero_comprobante',
      label: 'N° Comprobante',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string) => value || '-',
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'proveedor_nombre',
      label: 'Proveedor',
      sortable: false,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'items',
      label: 'Items',
      sortable: false,
      render: (value: unknown[]) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00AEEF]/10 text-[#00AEEF]">
          {value?.length || 0} producto{(value?.length || 0) !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'importe_total',
      label: 'Total',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium text-gray-900">{formatCurrency(value ?? 0)}</span>
      ),
    },
    {
      key: 'saldo_pendiente',
      label: 'Saldo',
      sortable: true,
      render: (value: number, row: IngresoMercaderia) => {
        const total = row.importe_total ?? 0
        const saldo = value ?? 0
        if (saldo === 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Saldado
            </span>
          )
        }
        if (saldo < total) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              Parcial · {formatCurrency(saldo)}
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            Pendiente · {formatCurrency(saldo)}
          </span>
        )
      },
    },
    {
      key: 'observacion',
      label: 'Observacion',
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
    {
      key: 'acciones',
      label: '',
      sortable: false,
      stickyRight: true,
      width: '60px',
      render: (_: unknown, row: IngresoMercaderia) => (
        <button
          type="button"
          onClick={() => setDetalleIngreso(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#00AEEF] bg-[#00AEEF]/10 rounded-lg hover:bg-[#00AEEF]/20 transition-colors"
          title="Ver detalle"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ], [setDetalleIngreso])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#00AEEF]/10">
            <Package className="w-6 h-6 text-[#00AEEF]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Registros de Compra</h1>
            <p className="text-sm text-gray-500 mt-1">Registra compras de productos al stock</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/admin/ingresos-mercaderia/nuevo')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva Compra
        </button>
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
        searchPlaceholder="Buscar por numero, proveedor..."
        storageKey="admin-ingresos-mercaderia-grid"
      />

      <IngresoDetalleModal
        ingreso={detalleIngreso}
        onClose={() => setDetalleIngreso(null)}
        onUpdate={(updated) => {
          setDetalleIngreso(updated)
          setData(prev => prev.map(i => i.id === updated.id ? updated : i))
        }}
      />
    </div>
  )
}
