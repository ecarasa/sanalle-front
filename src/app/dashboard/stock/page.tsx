'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import { Producto, PaginatedResponse } from '@/types'

function StockBadge({ stock }: { stock: number }) {
  let colorClass = 'bg-red-100 text-red-700'
  if (stock > 20) {
    colorClass = 'bg-green-100 text-green-700'
  } else if (stock >= 5) {
    colorClass = 'bg-amber-100 text-amber-700'
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}
    >
      {stock}
    </span>
  )
}

export default function StockPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [data, setData] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const debouncedSearch = useDebounce(search, 400)

  const isVentas = user?.rol === 'ventas'
  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { search: debouncedSearch, page, page_size: pageSize }
      if (Object.keys(columnFilters).length > 0) {
        params.filters = JSON.stringify(columnFilters)
      }
      const res = await api.get<PaginatedResponse<Producto>>('/productos', { params })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, pageSize, columnFilters])

  useEffect(() => {
    fetchProductos()
  }, [fetchProductos])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const handleExport = useCallback(async (format: string) => {
    try {
      if (format === 'json') {
        const res = await api.get('/exports/productos', {
          params: { format, search: debouncedSearch },
        })
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'productos.json'
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      if (format === 'imprimir') {
        const res = await api.get('/exports/productos', {
          params: { format: 'pdf', search: debouncedSearch },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        return
      }
      const res = await api.get('/exports/productos', {
        params: { format, search: debouncedSearch },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `productos.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    }
  }, [debouncedSearch])

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'foto_url',
      label: 'Foto',
      sortable: false,
      render: (value: string | null, row: Producto) =>
        value ? (
          <img
            src={value}
            alt={row.nombre}
            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
            <Package className="w-5 h-5 text-gray-400" />
          </div>
        ),
    },
    {
      key: 'codigo',
      label: 'C\u00F3digo',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'categoria_producto',
      label: 'Categoría',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'presentacion',
      label: 'Presentación',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'proveedor_nombre',
      label: 'Proveedor',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'blisters_por_caja',
      label: 'Pack/Caja',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number | null) => value || '-',
    },
    {
      key: 'stock_a_cajas',
      label: 'Stock A',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number) => <StockBadge stock={value} />,
    },
    {
      key: 'stock_disponible_a',
      label: 'Disp. A',
      sortable: true,
      render: (_value: unknown, row: Producto) => {
        const disponible = (row.stock_a_cajas ?? 0) - (row.stock_reservado_a_cajas ?? 0)
        return <span className="font-semibold text-gray-900">{disponible}</span>
      },
    },
    {
      key: 'stock_b_cajas',
      label: 'Stock B',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number) => <StockBadge stock={value} />,
    },
    {
      key: 'stock_disponible_b',
      label: 'Disp. B',
      sortable: true,
      render: (_value: unknown, row: Producto) => {
        const disponible = (row.stock_b_cajas ?? 0) - (row.stock_reservado_b_cajas ?? 0)
        return <span className="font-semibold text-gray-900">{disponible}</span>
      },
    },
    {
      key: 'precio_venta_minorista',
      label: 'Precio Minorista',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number | null) => (
        <span className="font-semibold text-blue-700">{value != null ? formatCurrency(value) : '-'}</span>
      ),
    },
    {
      key: 'precio_venta_mayorista',
      label: 'Precio Mayorista',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number | null) => (
        <span className="font-semibold text-purple-700">{value != null ? formatCurrency(value) : '-'}</span>
      ),
    },
    ...(isAdmin
      ? [
        {
          key: 'costo_mas_iibb',
          label: 'Costo + IIBB',
          sortable: true,
          filterable: true,
          filterType: 'number' as const,
          render: (value: number | null | undefined) => (
            <span className="font-medium text-gray-700">{value != null ? formatCurrency(value) : '-'}</span>
          ),
        },
        {
          key: 'rentabilidad',
          label: 'Rentabilidad',
          sortable: true,
          render: (_value: unknown, row: Producto) => {
            const costo = row.costo_mas_iibb
            if (!costo || costo === 0 || !row.precio_venta_minorista) return <span className="text-gray-400">-</span>
            const rent = ((row.precio_venta_minorista - costo) / costo) * 100
            return (
              <span className={`font-semibold ${rent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {rent.toFixed(1)}%
              </span>
            )
          },
        },
      ]
      : []),
    ...(!isVentas
      ? [
        {
          key: 'acciones',
          label: 'Acciones',
          stickyRight: true,
          sortable: false,
          render: (_value: unknown, _row: Producto) => (
            <span className="text-xs text-gray-400">-</span>
          ),
        },
      ]
      : []),
  ], [isVentas, isAdmin])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Stock / Productos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isVentas
              ? 'Consulta de stock y productos (solo lectura)'
              : 'Gesti\u00F3n de stock y productos'}
          </p>
        </div>
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
        onColumnFilter={(filters) => { setColumnFilters(filters); setPage(1) }}
        onExport={handleExport}
        searchPlaceholder="Buscar por código, nombre, categoría..."
        storageKey="stock-grid-columns"
        rowClassName={(row) => {
          const stockMinimo = row.stock_minimo_cajas
          if (stockMinimo && stockMinimo > 0 && row.stock_a_cajas <= stockMinimo) {
            return 'bg-red-50'
          }
          return ''
        }}
      />
    </div>
  )
}
