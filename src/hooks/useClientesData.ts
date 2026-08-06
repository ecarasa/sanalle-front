import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { ClienteConDeuda, PaginatedResponse } from '@/types'

interface Localidad {
  id: number
  nombre: string
}

export function useClientesData() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [data, setData] = useState<ClienteConDeuda[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [localidades, setLocalidades] = useState<Localidad[]>([])

  const debouncedSearch = useDebounce(search, 400)

  useEffect(() => {
    api.get<PaginatedResponse<Localidad>>('/localidades', { params: { page_size: 500 } })
      .then(res => setLocalidades(res.data.items))
      .catch(() => {})
  }, [])

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        search: debouncedSearch,
        page,
        page_size: pageSize,
      }
      if (Object.keys(columnFilters).length > 0) {
        params.filters = JSON.stringify(columnFilters)
      }
      const res = await api.get<PaginatedResponse<ClienteConDeuda>>('/clientes', { params })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, pageSize, columnFilters])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const handleExport = useCallback(async (format: string) => {
    try {
      if (format === 'json') {
        const res = await api.get('/exports/clientes', { params: { format, search: debouncedSearch } })
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
          params: { format: 'pdf', search: debouncedSearch },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        return
      }
      const res = await api.get('/exports/clientes', {
        params: { format, search: debouncedSearch },
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
  }, [debouncedSearch])

  const handleColumnFilter = useCallback((filters: Record<string, string>) => {
    setColumnFilters(filters)
    setPage(1)
  }, [])

  return {
    search, setSearch,
    page, setPage,
    pageSize, setPageSize,
    columnFilters,
    data,
    total,
    loading,
    localidades,
    fetchClientes,
    handleExport,
    handleColumnFilter,
  }
}
