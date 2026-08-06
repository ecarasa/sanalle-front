'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Package, ArrowRight, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import DataGrid from '@/components/grilla/DataGrid'
import { MovimientoStockResponse, PaginatedResponse } from '@/types'

const OPERACION_LABELS: Record<string, { label: string; color: string }> = {
  TRANSFER: { label: 'Transferencia', color: 'bg-blue-100 text-blue-700' },
  FRACTION: { label: 'Fraccionamiento', color: 'bg-amber-100 text-amber-700' },
  ADJUST: { label: 'Ajuste Manual', color: 'bg-red-100 text-red-700' },
}

const STOCK_LABELS: Record<string, string> = {
  STOCK_A: 'Stock A (Sanalle)',
  STOCK_B: 'Stock B (Farmacare)',
}

export default function HistorialStockPage() {
  const [data, setData] = useState<MovimientoStockResponse[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')

  const fetchMovimientos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<MovimientoStockResponse>>('/movimientos-stock', {
        params: {
          page,
          page_size: pageSize,
          search // Note: Backend search not implemented yet for this endpoint, but prepared for future
        }
      })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar historial de stock')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  const columns = useMemo(() => [
    {
      key: 'created_at',
      label: 'Fecha/Hora',
      sortable: true,
      render: (val: string) => (
        <span className="text-xs text-gray-500 font-medium">
          {format(new Date(val), "dd/MM/yy HH:mm", { locale: es })}
        </span>
      )
    },
    {
      key: 'producto_nombre',
      label: 'Producto',
      sortable: true,
      render: (val: string, row: MovimientoStockResponse) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900">{val}</span>
          <span className="text-[10px] text-gray-400 font-mono uppercase">ID: {row.producto_id}</span>
        </div>
      )
    },
    {
      key: 'tipo_operacion',
      label: 'Operación',
      render: (val: string) => {
        const config = OPERACION_LABELS[val] || { label: val, color: 'bg-gray-100 text-gray-600' }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${config.color}`}>
            {config.label}
          </span>
        )
      }
    },
    {
      key: 'detalle',
      label: 'Movimiento (Origen -> Destino)',
      render: (_: any, row: MovimientoStockResponse) => (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">
            {row.origen ? STOCK_LABELS[row.origen] || row.origen : '-'}
          </span>
          {(row.origen && row.destino) && <ArrowRight className="w-3 h-3 text-gray-300" />}
          <span className="text-xs font-semibold text-[#003087]">
            {row.destino ? STOCK_LABELS[row.destino] || row.destino : ''}
          </span>
        </div>
      )
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      render: (_: any, row: MovimientoStockResponse) => (
        <div className="flex items-center gap-2">
          {row.cantidad_cajas !== 0 && (
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-bold">
              {row.cantidad_cajas > 0 ? '+' : ''}{row.cantidad_cajas} cj
            </span>
          )}
          {row.cantidad_blisters !== 0 && (
            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#003087] text-xs font-bold">
              {row.cantidad_blisters > 0 ? '+' : ''}{row.cantidad_blisters} bl
            </span>
          )}
        </div>
      )
    },
    {
      key: 'usuario_nombre',
      label: 'Usuario',
      render: (val: string) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <User className="w-3 h-3" />
          {val}
        </div>
      )
    }
  ], [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Historial de Stock</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro detallado de todos los movimientos internos de mercader&iacute;a
        </p>
      </div>

      <DataGrid
        columns={columns}
        data={data}
        isLoading={loading}
        totalRows={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchValue={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar producto..."
      />
    </div>
  )
}
