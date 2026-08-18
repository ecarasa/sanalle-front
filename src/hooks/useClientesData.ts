import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { ClienteConDeuda, PaginatedResponse } from '@/types'

interface Localidad {
  id: number
  nombre: string
}

interface Zona {
  id: number
  nombre: string
}

// Columnas de filtro que exigen coincidencia exacta (selects); el resto hace "contiene".
const EXACT_FILTER_KEYS = new Set(['zona_nombre', 'tipo', 'semaforo', 'semaforo_actividad'])
// Campos sobre los que corre la búsqueda global.
const SEARCH_KEYS: (keyof ClienteConDeuda)[] = [
  'nombre', 'razon_social', 'cuit', 'domicilio', 'localidad_nombre', 'zona_nombre', 'vendedor_nombre',
]
const NUMERIC_SORT_KEYS = new Set(['id', 'deuda', 'saldo_remitos', 'saldo_facturas', 'dias_mora', 'dias_ultima_compra'])

type SortDir = 'asc' | 'desc'

function normalize(v: unknown): string {
  return String(v ?? '').toLowerCase().trim()
}

export function useClientesData() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null)

  // Todos los clientes en memoria (respuesta completa de la API, sin paginar).
  const [allData, setAllData] = useState<ClienteConDeuda[]>([])
  const [loading, setLoading] = useState(true)
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])

  useEffect(() => {
    api.get<PaginatedResponse<Localidad>>('/localidades', { params: { page_size: 500 } })
      .then(res => setLocalidades(res.data.items))
      .catch(() => {})
    api.get<PaginatedResponse<Zona> | Zona[]>('/zonas', { params: { page_size: 500 } })
      .then(res => {
        const items = Array.isArray(res.data) ? res.data : res.data.items
        setZonas(items ?? [])
      })
      .catch(() => {})
  }, [])

  // Carga única: trae TODOS los clientes de una sola vez.
  const fetchClientes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<ClienteConDeuda>>('/clientes', {
        params: { all: true },
      })
      setAllData(res.data.items)
    } catch {
      toast.error('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  // --- Filtrado + orden en memoria (instantáneo) ---
  const filtered = useMemo(() => {
    let rows = allData

    const q = normalize(search)
    if (q) {
      rows = rows.filter(row =>
        SEARCH_KEYS.some(k => normalize(row[k]).includes(q)),
      )
    }

    const filterEntries = Object.entries(columnFilters).filter(([, v]) => v !== '')
    if (filterEntries.length > 0) {
      rows = rows.filter(row =>
        filterEntries.every(([key, val]) => {
          const cell = (row as unknown as Record<string, unknown>)[key]
          if (EXACT_FILTER_KEYS.has(key)) {
            return normalize(cell) === normalize(val)
          }
          return normalize(cell).includes(normalize(val))
        }),
      )
    }

    if (sort) {
      const { key, dir } = sort
      const numeric = NUMERIC_SORT_KEYS.has(key)
      rows = [...rows].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[key]
        const bv = (b as unknown as Record<string, unknown>)[key]
        if (av == null && bv == null) return 0
        if (av == null) return dir === 'asc' ? -1 : 1
        if (bv == null) return dir === 'asc' ? 1 : -1
        let cmp: number
        if (numeric) {
          cmp = Number(av) - Number(bv)
        } else {
          cmp = String(av).localeCompare(String(bv), 'es', { numeric: true, sensitivity: 'base' })
        }
        return dir === 'asc' ? cmp : -cmp
      })
    }

    return rows
  }, [allData, search, columnFilters, sort])

  const total = filtered.length

  // Corrige la página si el filtrado dejó menos resultados que la página actual.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [total, pageSize, page])

  const data = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const handleExport = useCallback(async (format: string) => {
    try {
      if (format === 'json') {
        const res = await api.get('/exports/clientes', { params: { format, search } })
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'clientes.json'
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      if (format === 'imprimir') {
        const res = await api.get('/exports/clientes', {
          params: { format: 'pdf', search },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        return
      }
      const res = await api.get('/exports/clientes', {
        params: { format, search },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `clientes.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar')
    }
  }, [search])

  const handleColumnFilter = useCallback((filters: Record<string, string>) => {
    setColumnFilters(filters)
    setPage(1)
  }, [])

  const handleSort = useCallback((key: string, direction: SortDir) => {
    setSort({ key, dir: direction })
  }, [])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  return {
    search, setSearch: handleSearch,
    page, setPage,
    pageSize, setPageSize,
    columnFilters,
    data,
    total,
    loading,
    localidades,
    zonas,
    fetchClientes,
    handleExport,
    handleColumnFilter,
    handleSort,
  }
}
