'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowUpDown, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import SemaforoStockBadge from '@/components/stock/SemaforoStockBadge'
import OperacionStockModal from '@/components/stock/OperacionStockModal'
import { Deposito, Producto, PaginatedResponse, SemaforoStock } from '@/types'

type FiltroSemaforo = 'rojo' | 'amarillo' | 'verde' | 'sin_minimo' | null

interface ResumenSemaforo {
  rojo: number
  amarillo: number
  verde: number
  sin_minimo: number
}

const CHIPS: { valor: Exclude<FiltroSemaforo, null>; label: string; clase: string }[] = [
  { valor: 'rojo', label: 'Bajo mínimo', clase: 'bg-red-100 text-red-700 ring-red-300' },
  { valor: 'amarillo', label: 'En alerta', clase: 'bg-amber-100 text-amber-700 ring-amber-300' },
  { valor: 'verde', label: 'OK', clase: 'bg-green-100 text-green-700 ring-green-300' },
  { valor: 'sin_minimo', label: 'Sin mínimo', clase: 'bg-gray-100 text-gray-600 ring-gray-300' },
]

export default function StockPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [data, setData] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [depositos, setDepositos] = useState<Deposito[]>([])
  // Arranca filtrado si se llegó desde el widget "Stock bajo" del dashboard.
  const searchParams = useSearchParams()
  const [semaforo, setSemaforo] = useState<FiltroSemaforo>(
    (searchParams.get('semaforo_stock') as FiltroSemaforo) || null
  )
  const [resumen, setResumen] = useState<ResumenSemaforo | null>(null)
  const [productoAjuste, setProductoAjuste] = useState<Producto | null>(null)
  const [depositoAjuste, setDepositoAjuste] = useState<number | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const isVentas = user?.rol === 'ventas'
  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = {
        search: debouncedSearch,
        page,
        page_size: pageSize,
        incluir_resumen_semaforo: true,
      }
      if (semaforo) params.semaforo_stock = semaforo
      if (Object.keys(columnFilters).length > 0) {
        params.filters = JSON.stringify(columnFilters)
      }
      const res = await api.get<PaginatedResponse<Producto> & { resumen_semaforo?: ResumenSemaforo }>(
        '/productos',
        { params }
      )
      setData(res.data.items)
      setTotal(res.data.total)
      if (res.data.resumen_semaforo) setResumen(res.data.resumen_semaforo)
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, pageSize, columnFilters, semaforo])

  useEffect(() => {
    fetchProductos()
  }, [fetchProductos])

  // Los depósitos definen las columnas de stock de la grilla.
  useEffect(() => {
    api.get<Deposito[]>('/depositos')
      .then((res) => setDepositos((res.data ?? []).filter((d) => d.activo)))
      .catch(() => toast.error('Error al cargar depósitos'))
  }, [])

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

  // El mínimo se edita en la grilla porque cargarlo de a uno abriendo la ficha de
  // cada producto no es viable: hoy está en cero en todo el catálogo.
  const guardarMinimo = useCallback(async (row: Producto, valor: string) => {
    const cajas = parseInt(valor, 10) || 0
    if (cajas === row.stock_minimo_cajas) return
    try {
      await api.post('/stock/minimos-bulk', {
        items: [{
          producto_id: row.id,
          stock_minimo_cajas: cajas,
          // Se conserva: mandar 0 borraba el mínimo fraccionario de los productos
          // que se venden por blíster, que es justo para los que existe.
          stock_minimo_blisters: row.stock_minimo_blisters ?? 0,
        }],
      })
      fetchProductos()
    } catch {
      toast.error('No se pudo guardar el mínimo')
    }
  }, [fetchProductos])

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
    // Una columna de stock por depósito, con lo reservado al lado cuando lo hay.
    // Antes eran dos columnas fijas (A/B) y los depósitos nuevos no se veían.
    ...depositos.map((dep) => ({
      key: `stock_dep_${dep.id}`,
      label: dep.nombre,
      sortable: false,
      render: (_value: unknown, row: Producto) => {
        const st = row.stocks?.find((x) => x.deposito_id === dep.id)
        const reservado = st?.reservado_cajas ?? 0
        return (
          <div className="flex items-center gap-1.5">
            {/* Neutro a propósito: el mínimo es del producto, no del depósito;
                pintar cada depósito contra el mínimo global sería mentir. */}
            <button
              type="button"
              disabled={isVentas}
              onClick={() => { setProductoAjuste(row); setDepositoAjuste(dep.id) }}
              title={isVentas ? undefined : `Corregir el stock en ${dep.nombre}`}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 enabled:hover:bg-[#00AEEF]/15 enabled:hover:text-[#003087]"
            >
              {st?.cajas ?? 0}
            </button>
            {(st?.blisters ?? 0) > 0 && (
              <span className="text-[10px] text-gray-500">+{st?.blisters}bl</span>
            )}
            {reservado > 0 && (
              <span className="text-[10px] text-amber-600" title="Reservado en pedidos abiertos">
                ({reservado} res.)
              </span>
            )}
          </div>
        )
      },
    })),
    {
      key: 'stock_total_cajas',
      label: 'Stock Total',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (_value: unknown, row: Producto) => (
        <span className="inline-flex items-center gap-1.5">
          <SemaforoStockBadge semaforo={row.semaforo_stock} minimo={row.stock_minimo_cajas}>
            {row.stock_total_cajas}
          </SemaforoStockBadge>
          {row.stock_minimo_cajas > 0 && (
            <span className="text-[10px] text-gray-400">mín {row.stock_minimo_cajas}</span>
          )}
        </span>
      ),
    },
    ...(isAdmin
      ? [
        {
          key: 'stock_minimo_cajas',
          label: 'Mínimo',
          sortable: true,
          filterable: true,
          filterType: 'number' as const,
          render: (_value: unknown, row: Producto) => (
            <input
              type="number"
              min={0}
              defaultValue={row.stock_minimo_cajas || ''}
              placeholder="0"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => guardarMinimo(row, e.target.value)}
              title="Mínimo de reposición, en cajas"
              className="w-16 px-1.5 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20"
            />
          ),
        },
      ]
      : []),
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
          render: (_value: unknown, row: Producto) => (
            <button
              type="button"
              onClick={() => { setProductoAjuste(row); setDepositoAjuste(null) }}
              title="Ajustar stock"
              className="p-1.5 rounded-lg text-[#003087] hover:bg-[#003087]/10"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          ),
        },
      ]
      : []),
  ], [isVentas, isAdmin, depositos, guardarMinimo])

  return (
    <div className="space-y-6">
      {/* Semáforo: contador por color y filtro rápido */}
      {resumen && (
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => {
            const activo = semaforo === chip.valor
            return (
              <button
                key={chip.valor}
                type="button"
                onClick={() => { setSemaforo(activo ? null : chip.valor); setPage(1) }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${chip.clase} ${
                  activo ? 'ring-2' : 'ring-1 ring-transparent opacity-80 hover:opacity-100'
                }`}
              >
                {chip.label}
                <span className="font-bold">{resumen[chip.valor]}</span>
              </button>
            )
          })}
          {resumen.rojo + resumen.amarillo + resumen.verde === 0 && (
            <span className="text-xs text-gray-400">
              Ningún producto tiene mínimo configurado: el semáforo no puede pintar nada todavía.
            </span>
          )}
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
        onColumnFilter={(filters) => { setColumnFilters(filters); setPage(1) }}
        onExport={handleExport}
        searchPlaceholder="Buscar por código, nombre, categoría..."
        storageKey="stock-grid-columns"
        rowClassName={(row: Producto) =>
          row.semaforo_stock === 'rojo' ? 'bg-red-50' : row.semaforo_stock === 'amarillo' ? 'bg-amber-50' : ''
        }
      />

      {productoAjuste && (
        <OperacionStockModal
          producto={productoAjuste}
          depositos={depositos}
          depositoInicial={depositoAjuste}
          onClose={() => { setProductoAjuste(null); setDepositoAjuste(null) }}
          onDone={fetchProductos}
        />
      )}
    </div>
  )
}
