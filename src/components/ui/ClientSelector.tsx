'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X, ChevronDown, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Cliente, PaginatedResponse } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import toast from 'react-hot-toast'

interface ClientSelectorProps {
  selectedClienteId: number | null
  onClientSelect: (clienteId: number | null, cliente?: Cliente) => void
  disabled?: boolean
}

export default function ClientSelector({ selectedClienteId, onClientSelect, disabled = false }: ClientSelectorProps) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const debouncedClientSearch = useDebounce(clientSearch, 300)

  const fetchClientes = useCallback(async () => {
    setLoadingClientes(true)
    try {
      const res = await api.get<PaginatedResponse<Cliente>>('/clientes', {
        params: { page_size: 1000 },
      })
      setClientes(res.data.items)
    } catch {
      toast.error('Error al cargar clientes')
    } finally {
      setLoadingClientes(false)
    }
  }, [])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync external selected id with internal search state
  useEffect(() => {
    if (selectedClienteId) {
      const selected = clientes.find((c) => c.id === selectedClienteId)
      if (selected && clientSearch !== selected.nombre) {
        setClientSearch(selected.nombre)
      }
    } else if (clientes.length > 0) {
      setClientSearch('')
    }
  }, [selectedClienteId, clientes]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClientes = useMemo(() => {
    if (!debouncedClientSearch) return clientes
    const lower = debouncedClientSearch.toLowerCase()
    // Busca por nombre, CUIT y razón social (antes solo nombre).
    return clientes.filter((c) =>
      c.nombre.toLowerCase().includes(lower)
      || (c.cuit ?? '').toLowerCase().includes(lower)
      || (c.razon_social ?? '').toLowerCase().includes(lower)
    )
  }, [clientes, debouncedClientSearch])

  return (
    <div className="relative w-full z-20" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={clientSearch}
          disabled={disabled}
          onChange={(e) => {
            setClientSearch(e.target.value)
            setShowClientDropdown(true)
            if (e.target.value === '') {
              onClientSelect(null)
            }
          }}
          onClick={() => {
            if (!disabled) setShowClientDropdown(true)
          }}
          placeholder="Buscar cliente (mín. 3 letras) o ver todos..."
          className="w-full pl-12 pr-16 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white shadow-sm transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        {clientSearch && !disabled && (
          <button
            type="button"
            onClick={() => {
              setClientSearch('')
              onClientSelect(null)
            }}
            className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 transition-colors"
            title="Limpiar búsqueda"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!showClientDropdown) {
              setClientSearch('')
            }
            setShowClientDropdown(!showClientDropdown)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 transition-colors disabled:opacity-50"
          title="Mostrar todos los clientes"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showClientDropdown && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-50">
          <button
            type="button"
            onClick={() => {
              onClientSelect(null)
              setClientSearch('')
              setShowClientDropdown(false)
            }}
            className={`w-full text-left px-5 py-3.5 text-sm transition-colors border-l-2 ${selectedClienteId === null ? 'bg-blue-50/50 border-l-[#003087] font-medium text-[#003087]' : 'border-l-transparent hover:bg-gray-50 text-gray-700'}`}
          >
            Todos los clientes
          </button>
          {loadingClientes ? (
            <div className="px-5 py-4 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#003087]" /> Cargando...
            </div>
          ) : clientSearch.length > 0 && clientSearch.length < 3 && filteredClientes.length > 0 ? (
            <div className="px-5 py-4 text-sm text-gray-500 bg-gray-50/50">
              Escriba al menos 3 letras para filtrar u oprima la flecha para ver todos.
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-500 text-center">No se encontraron clientes</div>
          ) : (
            filteredClientes.map(c => {
              const secundario = [c.cuit, c.razon_social].filter(Boolean).join(' · ')
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onClientSelect(c.id, c)
                    setClientSearch(c.nombre)
                    setShowClientDropdown(false)
                  }}
                  className={`w-full text-left px-5 py-3 text-sm transition-colors border-l-2 ${selectedClienteId === c.id ? 'bg-blue-50/50 border-l-[#003087] text-[#003087]' : 'border-l-transparent hover:bg-gray-50 text-gray-700'}`}
                >
                  <span className={`block ${selectedClienteId === c.id ? 'font-semibold' : 'font-medium'}`}>{c.nombre}</span>
                  {secundario && <span className="block text-xs text-gray-400 mt-0.5">{secundario}</span>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
