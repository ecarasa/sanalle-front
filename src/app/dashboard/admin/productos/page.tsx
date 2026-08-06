'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, ArrowUpDown, Upload, CheckCircle2, AlertTriangle, DollarSign, Download, FileSpreadsheet, Webcam } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useDebounce } from '@/hooks/useDebounce'
import DataGrid from '@/components/grilla/DataGrid'
import ProductoModal from '@/components/admin/ProductoModal'
import { listasDe, MargenField } from '@/lib/listas'
import { Producto, PaginatedResponse, Proveedor, Laboratorio } from '@/types'

const LISTAS_COMERCIO = listasDe('comercio')

type BulkPriceCampo = 'pvp' | 'costo_porcentaje' | MargenField

const MARGEN_CAMPOS: MargenField[] = ['margen_minorista', 'margen_mayorista', ...LISTAS_COMERCIO.map((l) => l.margenField)]

const esMargen = (campo: BulkPriceCampo): campo is MargenField => (MARGEN_CAMPOS as string[]).includes(campo)

function StockPoolBadge({ cajas, blisters, label, color }: { cajas: number; blisters: number; label: string; color: 'blue' | 'slate' }) {
  const total = cajas + blisters / 100
  const colorMap = {
    blue: total > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200',
    slate: total > 0 ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-gray-50 text-gray-400 border-gray-200',
  }
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${colorMap[color]}`}>
      <span className="font-bold">{label}</span>
      <span>{cajas}cj{blisters > 0 ? ` +${blisters}bl` : ''}</span>
    </div>
  )
}

function DualStockCell({ row }: { row: Producto }) {
  return (
    <div className="flex flex-col gap-0.5">
      <StockPoolBadge cajas={row.stock_a_cajas} blisters={row.stock_a_blisters} label="A" color="blue" />
      <StockPoolBadge cajas={row.stock_b_cajas} blisters={row.stock_b_blisters} label="B" color="slate" />
    </div>
  )
}


export default function AdminProductosPage() {
  const { user } = useAuth()
  const { isEnabled } = useFeatureFlags()
  // Pestaña "Ajuste" (+/-) gobernada por feature flag; super_admin siempre la ve
  const canManualAdjust = user?.rol === 'super_admin' || isEnabled('ajuste_stock_manual')
  const stockOps: Array<'transfer' | 'fraction' | 'manual'> = canManualAdjust
    ? ['transfer', 'fraction', 'manual']
    : ['transfer', 'fraction']
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [data, setData] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [proveedorId, setProveedorId] = useState<string>('')
  const [laboratorioId, setLaboratorioId] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<Producto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null)

  const [stockModal, setStockModal] = useState<Producto | null>(null)
  const [stockAdjustOp, setStockAdjustOp] = useState<'transfer' | 'fraction' | 'manual'>('transfer')
  const [stockAdjustPool, setStockAdjustPool] = useState<'a' | 'b'>('a')
  const [stockAdjustTarget, setStockAdjustTarget] = useState<'a' | 'b'>('b')
  const [stockAdjustCajas, setStockAdjustCajas] = useState('')
  const [stockAdjustBlisters, setStockAdjustBlisters] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const [bulkPriceModal, setBulkPriceModal] = useState(false)
  const [bulkPriceTab, setBulkPriceTab] = useState<'porcentaje' | 'alfabeta'>('porcentaje')
  const [bulkPricePercent, setBulkPricePercent] = useState('')
  const [bulkPriceCampo, setBulkPriceCampo] = useState<BulkPriceCampo>('pvp')
  const [bulkPriceApplying, setBulkPriceApplying] = useState(false)
  const [bulkPriceFiltro, setBulkPriceFiltro] = useState<'todos' | 'proveedor' | 'categoria' | 'laboratorio'>('todos')
  const [bulkPriceFiltroId, setBulkPriceFiltroId] = useState<string>('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelImporting, setExcelImporting] = useState(false)
  const [excelResult, setExcelResult] = useState<{ updated: number; skipped: number; errors: string[] } | null>(null)
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<{ total: number; updated: number; failed: number; skipped: number } | null>(null)

  // Master data options for dropdowns
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([])

  const debouncedSearch = useDebounce(search, 400)

  // Fetch master data for dropdowns
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const pRes = await api.get<PaginatedResponse<Proveedor>>('/proveedores', { params: { page_size: 1000 } })
        setProveedores(pRes.data.items)
        const lRes = await api.get<PaginatedResponse<Laboratorio>>('/laboratorios', { params: { page_size: 1000 } })
        setLaboratorios(lRes.data.items)
      } catch {
        // Options will just be empty, forms still work
      }
    }
    fetchOptions()
  }, [])

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { search: debouncedSearch, page, page_size: pageSize }
      if (proveedorId) params.proveedor_id = proveedorId
      if (laboratorioId) params.laboratorio_id = laboratorioId
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
  }, [debouncedSearch, page, pageSize, columnFilters, proveedorId, laboratorioId])

  useEffect(() => {
    fetchProductos()
  }, [fetchProductos])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, proveedorId, laboratorioId])

  const openCreate = () => {
    setEditingProducto(null)
    setModalOpen(true)
  }

  const openEdit = (producto: Producto) => {
    setEditingProducto(producto)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProducto(null)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await api.delete(`/productos/${deleteConfirm.id}`)
      toast.success('Producto eliminado correctamente')
      setDeleteConfirm(null)
      fetchProductos()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al eliminar producto')
    } finally {
      setDeleting(false)
    }
  }

  const openStockAdjust = (producto: Producto) => {
    setStockModal(producto)
    setStockAdjustOp('transfer')
    setStockAdjustPool('a')
    setStockAdjustTarget('b')
    setStockAdjustCajas('')
    setStockAdjustBlisters('')
  }

  const handleStockAdjust = async () => {
    if (!stockModal) return
    if (stockAdjustOp === 'manual' && !canManualAdjust) return
    const cajasAdj = parseInt(stockAdjustCajas) || 0
    const blistersAdj = parseInt(stockAdjustBlisters) || 0

    setAdjusting(true)
    try {
      const payload = {
        tipo_operacion: stockAdjustOp === 'manual' ? 'ADJUST' : stockAdjustOp.toUpperCase(),
        origen: stockAdjustPool === 'a' ? 'STOCK_A' : 'STOCK_B',
        destino: stockAdjustOp === 'transfer' ? (stockAdjustTarget === 'a' ? 'STOCK_A' : 'STOCK_B') : null,
        cantidad_cajas: cajasAdj,
        cantidad_blisters: blistersAdj,
        observacion: stockAdjustOp === 'manual' ? 'Ajuste manual de stock' : null
      }

      await api.post(`/productos/${stockModal.id}/operacion-stock`, payload)
      toast.success('Operación registrada correctamente')
      setStockModal(null)
      fetchProductos()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error en la operación')
    } finally {
      setAdjusting(false)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportFile(file)
    setImportResult(null)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/productos/import-template', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_productos.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar la plantilla')
    }
  }

  const handleImportSubmit = async () => {
    if (!importFile) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await api.post('/productos/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      toast.success(`Importacion completada: ${res.data.created} creados, ${res.data.updated} actualizados`)
      fetchProductos()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } }
      const detail = error.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg).join(', ')
        : typeof detail === 'string' ? detail : 'Error al importar'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  const handleBulkPriceUpdate = async () => {
    const percent = parseFloat(bulkPricePercent)
    if (isNaN(percent)) {
      toast.error('Ingrese un porcentaje válido')
      return
    }
    setBulkPriceApplying(true)
    try {
      const res = await api.post('/productos/actualizar-precios-porcentaje', {
        porcentaje: percent,
        campo: bulkPriceCampo,
        filtro: bulkPriceFiltro,
        filtro_id: bulkPriceFiltroId ? parseInt(bulkPriceFiltroId) : null,
      })
      toast.success(`${res.data.updated} productos actualizados (${percent > 0 ? '+' : ''}${percent}%)`)
      setBulkPriceModal(false)
      setBulkPricePercent('')
      setBulkPriceCampo('pvp')
      setBulkPriceFiltro('todos')
      setBulkPriceFiltroId('')
      fetchProductos()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al actualizar precios')
    } finally {
      setBulkPriceApplying(false)
    }
  }

  const handleTriggerPvpScrape = async () => {
    setScraping(true)
    setScrapeResult(null)
    try {
      const res = await api.post('/scraper/trigger-pvp-scrape')
      setScrapeResult(res.data)
      toast.success('Actualización de precios completada')
      fetchProductos()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al iniciar el scrape')
    } finally {
      setScraping(false)
    }
  }

  const handleUploadPriceExcel = async () => {
    if (!excelFile) return
    setExcelImporting(true)
    setExcelResult(null)
    try {
      const formData = new FormData()
      formData.append('file', excelFile)
      const res = await api.post('/productos/precios-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setExcelResult(res.data)
      toast.success(`${res.data.updated} precios actualizados`)
      fetchProductos()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al importar Excel')
    } finally {
      setExcelImporting(false)
    }
  }

  const closeImportModal = () => {
    setImportModalOpen(false)
    setImportFile(null)
    setImportFileName('')
    setImportResult(null)
  }

  const handleExport = useCallback(async (format: string) => {
    try {
      if (format === 'json') {
        const res = await api.get('/exports/productos', { params: { format, search: debouncedSearch } })
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
      width: '60px',
    },
    {
      key: 'codigo',
      label: 'Codigo',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      width: '120px',
    },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
    },
    {
      key: 'proveedor_nombre',
      label: 'Proveedor',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => (
        <span className="text-gray-600 text-sm">{value || '-'}</span>
      ),
    },
    {
      key: 'laboratorio_nombre',
      label: 'Laboratorio',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => (
        <span className="text-gray-600 text-sm">{value || '-'}</span>
      ),
    },
    {
      key: 'presentacion',
      label: 'Presentacion',
      sortable: true,
      filterable: true,
      filterType: 'text' as const,
      render: (value: string | null) => (
        <span className="text-gray-600 text-sm">{value || '-'}</span>
      ),
    },
    {
      key: 'categoria_producto',
      label: 'Categoría',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [{ label: 'GENERICO', value: 'GENERICO' }, { label: 'OTC', value: 'OTC' }],
      render: (value: string | null) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${value === 'OTC' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'stock_a_cajas',
      label: 'Stock',
      sortable: true,
      width: '130px',
      render: (_: unknown, row: Producto) => <DualStockCell row={row} />,
    },
    {
      key: 'pvp',
      label: 'PVP',
      sortable: true,
      filterable: true,
      filterType: 'number' as const,
      render: (value: number | null) => (
        <span className="font-semibold text-gray-900">{value != null ? formatCurrency(value) : '-'}</span>
      ),
    },
    {
      key: 'costo_mas_iibb',
      label: 'Costo+IIBB',
      sortable: true,
      render: (value: number | null) => (
        <span className="text-gray-500 text-sm">{value != null ? formatCurrency(value) : '-'}</span>
      ),
    },
    {
      key: 'margen_minorista',
      label: 'Mg. Min.',
      sortable: true,
      width: '80px',
      render: (value: number | null) => (
        <span className="text-xs font-medium text-gray-400">{value != null ? `${value}%` : '-'}</span>
      ),
    },
    {
      key: 'precio_venta_minorista',
      label: 'Minorista',
      sortable: true,
      render: (value: number | null) => (
        <span className="font-bold text-[#003087]">{value != null ? formatCurrency(value) : '-'}</span>
      ),
    },
    {
      key: 'margen_mayorista',
      label: 'Mg. May.',
      sortable: true,
      width: '80px',
      render: (value: number | null) => (
        <span className="text-xs font-medium text-gray-400">{value != null ? `${value}%` : '-'}</span>
      ),
    },
    {
      key: 'precio_venta_mayorista',
      label: 'Mayorista',
      sortable: true,
      render: (value: number | null) => (
        <span className="font-bold text-teal-700">{value != null ? formatCurrency(value) : '-'}</span>
      ),
    },
    // Lista Comercio: el PRECIO se muestra en el listado (como minorista y mayorista);
    // el margen queda en el selector de columnas (se edita desde el modal).
    // Sin margen cargado no hay precio: se muestra "—".
    ...LISTAS_COMERCIO.flatMap((lista) => [
      {
        key: lista.margenField,
        label: 'Mg. Com.',
        sortable: true,
        width: '90px',
        render: (value: number | null) => (
          <span className="text-xs font-medium text-gray-400">{value != null ? `${value}%` : '—'}</span>
        ),
      },
      {
        key: lista.precioField,
        label: lista.short,
        sortable: true,
        render: (value: number | null) => (
          <span className={`font-bold ${value != null ? lista.colorClass : 'text-gray-300'}`}>
            {value != null ? formatCurrency(value) : '—'}
          </span>
        ),
      },
    ]),
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      filterable: true,
      filterType: 'select' as const,
      filterOptions: [{ label: 'Activo', value: 'activo' }, { label: 'Inactivo', value: 'inactivo' }],
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      stickyRight: true,
      sortable: false,
      render: (_value: unknown, row: Producto) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openStockAdjust(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#00AEEF] bg-[#00AEEF]/10 rounded-lg hover:bg-[#00AEEF]/20 transition-colors"
            title="Ajuste Stock"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Productos (Admin)</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona productos, stock y precios</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setBulkPriceModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Actualizar Precios</span>
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar Excel</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Producto</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Filtrar por Proveedor</label>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] min-w-[200px]"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Filtrar por Laboratorio</label>
          <select
            value={laboratorioId}
            onChange={(e) => setLaboratorioId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] min-w-[200px]"
          >
            <option value="">Todos los laboratorios</option>
            {laboratorios.map(l => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => { setSearch(''); setProveedorId(''); setLaboratorioId(''); setColumnFilters({}) }}
          className="mt-5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Limpiar Filtros
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
        onColumnFilter={(filters) => { setColumnFilters(filters); setPage(1) }}
        onExport={handleExport}
        searchPlaceholder="Buscar por codigo, nombre, origen..."
        storageKey="admin-productos-grid-columns"
      />

      <ProductoModal
        open={modalOpen}
        editingProducto={editingProducto}
        proveedores={proveedores}
        laboratorios={laboratorios}
        onClose={closeModal}
        onSaved={fetchProductos}
      />

      {/* Stock Adjustment Modal */}      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setStockModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#00AEEF]/10">
                  <ArrowUpDown className="w-5 h-5 text-[#00AEEF]" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Operación de Stock</h2>
              </div>
              <button type="button" onClick={() => setStockModal(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {stockOps.map((op) => (
                <button
                  key={op}
                  onClick={() => {
                    setStockAdjustOp(op)
                    setStockAdjustCajas('')
                    setStockAdjustBlisters('')
                  }}
                  className={`flex-1 py-3 text-xs font-bold uppercase transition-colors ${stockAdjustOp === op
                    ? 'text-[#00AEEF] border-b-2 border-[#00AEEF]'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  {op === 'transfer' ? 'Transferir' : op === 'fraction' ? 'Fraccionar' : 'Ajuste'}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* Producto info */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-sm font-bold text-gray-800">{stockModal.nombre}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">{stockModal.codigo}</p>
                  <p className="text-xs font-medium text-[#003087]">1 caja = {stockModal.blisters_por_caja || '?'} blisters</p>
                </div>
              </div>

              {stockAdjustOp === 'transfer' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-2 items-center">
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Origen</label>
                      <select
                        value={stockAdjustPool}
                        onChange={(e) => {
                          const val = e.target.value as 'a' | 'b'
                          setStockAdjustPool(val)
                          setStockAdjustTarget(val === 'a' ? 'b' : 'a')
                        }}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
                      >
                        <option value="a">Stock A (Sanalle)</option>
                        <option value="b">Stock B (Farmacare)</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-center pt-5">
                      <ArrowUpDown className="w-4 h-4 text-gray-300 rotate-90" />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Destino</label>
                      <div className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs font-bold text-[#003087]">
                        {stockAdjustTarget === 'a' ? 'Stock A (Sanalle)' : 'Stock B (Farmacare)'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cajas a Mover</label>
                      <input
                        type="number"
                        min="0"
                        value={stockAdjustCajas}
                        onChange={(e) => setStockAdjustCajas(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Blisters a Mover</label>
                      <input
                        type="number"
                        min="0"
                        value={stockAdjustBlisters}
                        onChange={(e) => setStockAdjustBlisters(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {stockAdjustOp === 'fraction' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-2">Seleccionar Stock para Fraccionar</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['a', 'b'] as const).map(pool => (
                        <button
                          key={pool}
                          onClick={() => setStockAdjustPool(pool)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${stockAdjustPool === pool ? 'border-[#003087] bg-blue-50' : 'border-gray-100 bg-white'
                            }`}
                        >
                          <p className="text-[10px] font-black uppercase text-gray-400">Stock {pool.toUpperCase()}</p>
                          <p className="text-xs font-bold">{pool === 'a' ? stockModal.stock_a_cajas : stockModal.stock_b_cajas} cj disponibles</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                    <p className="text-xs text-amber-800 font-medium">Esta acción restará <span className="font-bold">1 caja</span> y sumará <span className="font-bold text-lg">{stockModal.blisters_por_caja || 0} blisters</span> al Stock {stockAdjustPool.toUpperCase()}</p>
                  </div>
                </div>
              )}

              {stockAdjustOp === 'manual' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {(['a', 'b'] as const).map(pool => (
                      <button
                        key={pool}
                        onClick={() => setStockAdjustPool(pool)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${stockAdjustPool === pool ? 'border-red-400 bg-red-50' : 'border-gray-100 bg-white'
                          }`}
                      >
                        <p className="text-[10px] font-black uppercase text-gray-400">Stock {pool.toUpperCase()}</p>
                        <p className="text-xs font-bold">{pool === 'a' ? stockModal.stock_a_cajas : stockModal.stock_b_cajas} cj + {pool === 'a' ? stockModal.stock_a_blisters : stockModal.stock_b_blisters} bl</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ajuste Cajas (+/-)</label>
                      <input
                        type="number"
                        value={stockAdjustCajas}
                        onChange={(e) => setStockAdjustCajas(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ajuste Blisters (+/-)</label>
                      <input
                        type="number"
                        value={stockAdjustBlisters}
                        onChange={(e) => setStockAdjustBlisters(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-red-500 italic text-center">Precaución: El ajuste manual solo debe usarse para correcciones de inventario físico.</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStockModal(null)}
                  className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleStockAdjust}
                  disabled={adjusting || (stockAdjustOp === 'transfer' && !stockAdjustCajas && !stockAdjustBlisters) || (stockAdjustOp === 'fraction' && (stockAdjustPool === 'a' ? stockModal.stock_a_cajas : stockModal.stock_b_cajas) <= 0)}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-[#00AEEF] rounded-xl hover:bg-[#0098d4] shadow-lg shadow-[#00AEEF]/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {adjusting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {stockAdjustOp === 'transfer' ? 'Confirmar Transferencia' : stockAdjustOp === 'fraction' ? 'Fraccionar Caja' : 'Aplicar Ajuste'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Eliminar Producto</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Esta seguro que desea eliminar <strong>{deleteConfirm.nombre}</strong> ({deleteConfirm.codigo})? Esta accion no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeImportModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#003087]/10">
                  <FileSpreadsheet className="w-5 h-5 text-[#003087]" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Importar Productos (Excel)</h2>
              </div>
              <button type="button" onClick={closeImportModal} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Plantilla Excel</p>
                  <p className="text-xs text-gray-500">Descargá el formato correcto antes de importar</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#003087] border border-[#003087]/30 rounded-lg hover:bg-[#003087]/5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar plantilla
                </button>
              </div>

              <div>
                <label
                  htmlFor="import-productos-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#003087]/50 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-600">
                    {importFileName || 'Seleccionar archivo Excel (.xlsx)'}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">Usar la plantilla descargada para importar</span>
                  <input
                    id="import-productos-file"
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </label>
              </div>

              {importFile && !importResult && (
                <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{importFileName}</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Si el código ya existe se actualizará, sino se creará nuevo
                    </p>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">Importacion completada</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-lg font-bold text-green-600">{importResult.created}</p>
                      <p className="text-xs text-gray-500">Creados</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-lg font-bold text-blue-600">{importResult.updated}</p>
                      <p className="text-xs text-gray-500">Actualizados</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-400">{importResult.skipped}</p>
                      <p className="text-xs text-gray-500">Omitidos</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 bg-amber-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-800">Errores:</span>
                      </div>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-amber-700">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {importResult ? 'Cerrar' : 'Cancelar'}
                </button>
                {!importResult && (
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={importing || !importFile}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
                  >
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Importar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price Update Modal */}
      {bulkPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setBulkPriceModal(false); setExcelFile(null); setExcelResult(null) }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Actualizar Precios</h3>
              </div>
              <button type="button" onClick={() => { setBulkPriceModal(false); setExcelFile(null); setExcelResult(null) }} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setBulkPriceTab('porcentaje')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${bulkPriceTab === 'porcentaje' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Por Porcentaje
              </button>
              <button
                type="button"
                onClick={() => setBulkPriceTab('alfabeta')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${bulkPriceTab === 'alfabeta' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span className="inline-flex items-center gap-1.5"><Webcam className="w-3.5 h-3.5" />Alfabeta (Automatico)</span>
              </button>
            </div>

            {/* Filter - shared between tabs */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              {
                bulkPriceFiltro === 'proveedor' && (
                  <>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Aplicar a</label>
                    <div className="flex flex-wrap gap-3 mb-2">
                      {(['todos', 'proveedor', 'categoria', 'laboratorio'] as const).map((f) => (
                        <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="bulkFiltro"
                            checked={bulkPriceFiltro === f}
                            onChange={() => { setBulkPriceFiltro(f); setBulkPriceFiltroId('') }}
                            className="accent-amber-600"
                          />
                          {f === 'todos' ? 'Todos' : f === 'proveedor' ? 'Por Proveedor' : f === 'categoria' ? 'Por Categoría' : 'Por Laboratorio'}
                        </label>
                      ))}
                    </div>
                  </>
                )
              }
              {bulkPriceFiltro === 'proveedor' && (
                <select
                  value={bulkPriceFiltroId}
                  onChange={(e) => setBulkPriceFiltroId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              )}
              {bulkPriceFiltro === 'categoria' && (
                <select
                  value={bulkPriceFiltroId}
                  onChange={(e) => setBulkPriceFiltroId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                >
                  <option value="">Seleccionar categoría...</option>

                  <option key={1} value={1}>OTC</option>
                  <option key={2} value={2}>GENERICO</option>


                </select>
              )}
              {bulkPriceFiltro === 'laboratorio' && (
                <select
                  value={bulkPriceFiltroId}
                  onChange={(e) => setBulkPriceFiltroId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                >
                  <option value="">Seleccionar laboratorio...</option>
                  {laboratorios.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Tab: Por Porcentaje */}
            {bulkPriceTab === 'porcentaje' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campo a actualizar</label>
                  <select
                    value={bulkPriceCampo}
                    onChange={(e) => setBulkPriceCampo(e.target.value as BulkPriceCampo)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                  >
                    <option value="pvp">PVP (Sugerido Laboratorio)</option>
                    <option value="costo_porcentaje">Costo % (Descuento)</option>
                    <option value="margen_minorista">Margen Minorista</option>
                    <option value="margen_mayorista">Margen Mayorista</option>
                    {LISTAS_COMERCIO.map((lista) => (
                      <option key={lista.key} value={lista.margenField}>
                        Margen {lista.short}
                      </option>
                    ))}
                  </select>
                  {esMargen(bulkPriceCampo) && (
                    <p className="mt-1.5 text-[11px] text-gray-500 italic leading-snug">
                      Los productos que no tengan este margen cargado se saltean: no se les inventa la lista.
                    </p>
                  )}
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 leading-relaxed border border-blue-100 italic">
                  {bulkPriceCampo === 'pvp' && 'El ajuste de PVP es multiplicativo (+5% aumenta el valor). Todos los costos y precios de venta se recalcularán automáticamente.'}
                  {bulkPriceCampo === 'costo_porcentaje' && 'El ajuste de Costo % es aditivo (+5% suma puntos al descuento actual). El costo neto se recalculará.'}
                  {esMargen(bulkPriceCampo) && (
                    <>
                      El ajuste de Margen es aditivo (+5% suma puntos al margen).
                      {bulkPriceFiltro === 'proveedor' && (bulkPriceCampo === 'margen_minorista' || bulkPriceCampo === 'margen_mayorista') && (
                        <span className="font-bold underline block mt-1">
                          IMPORTANTE: Se actualizará también el margen predeterminado del PROVEEDOR.
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 whitespace-nowrap">
                    {bulkPriceCampo === 'pvp' ? 'Porcentaje de aumento/disminución (%)' : 'Puntos a sumar/restar'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bulkPricePercent}
                    onChange={(e) => setBulkPricePercent(e.target.value)}
                    placeholder={bulkPriceCampo === 'pvp' ? "Ej: 10 para +10%" : "Ej: 5 para +5 puntos"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-center text-lg font-semibold"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setBulkPriceModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkPriceUpdate}
                    disabled={bulkPriceApplying || !bulkPricePercent || (bulkPriceFiltro !== 'todos' && !bulkPriceFiltroId)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {bulkPriceApplying && <Loader2 className="w-4 h-4 animate-spin" />}
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Por Excel */}
            {bulkPriceTab === 'alfabeta' && (
              <div className="space-y-4">
                <div className="p-3 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Sincronización automática de precios (Alfabeta)</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Este proceso recorrerá todos los productos que tengan configurada una URL de Alfabeta y actualizará su PVP automáticamente.
                  </p>
                  <button
                    type="button"
                    onClick={handleTriggerPvpScrape}
                    disabled={scraping}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
                  >
                    {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Webcam className="w-4 h-4" />}
                    Ejecutar Actualización Masiva
                  </button>
                </div>

                {scrapeResult && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                    <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Resultados de la sincronización:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-white rounded border border-blue-50">
                        <p className="text-[10px] uppercase font-bold text-gray-400">Total Analizados</p>
                        <p className="text-lg font-bold text-gray-800">{scrapeResult.total}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-blue-50">
                        <p className="text-[10px] uppercase font-bold text-gray-400 text-emerald-500">Actualizados</p>
                        <p className="text-lg font-bold text-emerald-600">{scrapeResult.updated}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-blue-50">
                        <p className="text-[10px] uppercase font-bold text-gray-400 text-amber-500">Sin cambios</p>
                        <p className="text-lg font-bold text-amber-600">{scrapeResult.skipped}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-blue-50">
                        <p className="text-[10px] uppercase font-bold text-gray-400 text-red-500">Fallidos</p>
                        <p className="text-lg font-bold text-red-600">{scrapeResult.failed}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
