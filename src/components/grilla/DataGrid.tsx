'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { SearchField, Label, Input as AriaInput } from 'react-aria-components'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Inbox,
  Filter,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import ExportMenu from './ExportMenu'
import ColumnSelector from './ColumnSelector'

interface Column {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  filterType?: 'text' | 'select' | 'number' | 'boolean'
  filterOptions?: { label: string; value: string }[]
  render?: (value: any, row: any) => React.ReactNode
  className?: string
  defaultVisible?: boolean
  stickyRight?: boolean
}

interface DataGridProps {
  columns: Column[]
  data: any[]
  isLoading?: boolean
  totalRows: number
  page: number
  pageSize: number
  searchValue?: string
  onSearch?: (value: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  onColumnFilter?: (filters: Record<string, string>) => void
  onExport?: (format: string) => void
  searchPlaceholder?: string
  exportFormats?: string[]
  storageKey?: string
  actions?: React.ReactNode
  rowClassName?: (row: any) => string
  renderCustomRow?: (row: any) => React.ReactNode
}

const PAGE_SIZES = [10, 25, 50, 100]

const DataGridRow = React.memo(function DataGridRow({
  row,
  visibleColumns,
  rowClassName,
}: {
  row: any
  visibleColumns: Column[]
  rowClassName?: string
}) {
  return (
    <tr className={`group border-b border-gray-50 hover:bg-gray-50 transition-colors ${rowClassName || ''}`}>
      {visibleColumns.map((col) => (
        <td
          key={col.key}
          className={`px-4 py-2 text-gray-700 whitespace-nowrap ${col.className || ''} ${
            col.stickyRight ? 'sticky right-0 bg-white group-hover:bg-gray-50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] border-l border-gray-100' : ''
          }`}
        >
          {col.render ? col.render(row[col.key], row) : row[col.key]}
        </td>
      ))}
    </tr>
  )
})

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

export default function DataGrid({
  columns,
  data = [],
  isLoading = false,
  totalRows,
  page,
  pageSize,
  searchValue = '',
  onSearch,
  onPageChange,
  onPageSizeChange,
  onSort,
  onColumnFilter,
  onExport,
  searchPlaceholder = 'Buscar...',
  exportFormats,
  storageKey,
  actions,
  rowClassName,
  renderCustomRow,
}: DataGridProps) {
  const [localSearch, setLocalSearch] = useState(searchValue)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useIsMobile()

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({})
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) return JSON.parse(saved)
      } catch {
        // ignore
      }
    }
    return columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)
  })

  useEffect(() => {
    setLocalSearch(searchValue)
  }, [searchValue])

  // Sync visibleKeys when columns prop changes (e.g. new column added)
  useEffect(() => {
    setVisibleKeys((prev) => {
      const newDefaultKeys = columns
        .filter((c) => c.defaultVisible !== false && !prev.includes(c.key))
        .map((c) => c.key)
      if (newDefaultKeys.length > 0) {
        return [...prev, ...newDefaultKeys]
      }
      return prev
    })
  }, [columns])

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch?.(value)
      }, 350)
    },
    [onSearch],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
    }
  }, [])

  const handleFilterChange = useCallback(
    (key: string, value: string, filterType?: string) => {
      setLocalFilters((prev) => {
        const next = { ...prev }
        if (value === '') {
          delete next[key]
        } else {
          next[key] = value
        }
        return next
      })

      if (filterType === 'select' || filterType === 'boolean') {
        setColumnFilters((prev) => {
          const next = { ...prev }
          if (value === '') {
            delete next[key]
          } else {
            next[key] = value
          }
          if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
          filterDebounceRef.current = setTimeout(() => {
            onColumnFilter?.(next)
          }, 50)
          return next
        })
      } else {
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
        filterDebounceRef.current = setTimeout(() => {
          setColumnFilters((prev) => {
            const next = { ...prev }
            if (value === '') {
              delete next[key]
            } else {
              next[key] = value
            }
            onColumnFilter?.(next)
            return next
          })
        }, 400)
      }
    },
    [onColumnFilter],
  )

  const clearAllFilters = useCallback(() => {
    setLocalFilters({})
    setColumnFilters({})
    onColumnFilter?.({})
  }, [onColumnFilter])

  const activeFilterCount = Object.keys(columnFilters).length

  const handleSort = useCallback(
    (key: string) => {
      let direction: 'asc' | 'desc' = 'asc'
      if (sortKey === key && sortDir === 'asc') {
        direction = 'desc'
      }
      setSortKey(key)
      setSortDir(direction)
      onSort?.(key, direction)
    },
    [sortKey, sortDir, onSort],
  )

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleKeys.includes(c.key)),
    [columns, visibleKeys],
  )

  const hasFilterableColumns = visibleColumns.some((c) => c.filterable)

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const startRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, totalRows)

  const renderFilterInput = useCallback((col: Column) => {
    if (!col.filterable) return null
    const filterType = col.filterType || 'text'
    const value = localFilters[col.key] || ''

    if (filterType === 'select' || filterType === 'boolean') {
      const options =
        filterType === 'boolean'
          ? [
              { label: 'Si', value: 'true' },
              { label: 'No', value: 'false' },
            ]
          : col.filterOptions || []

      return (
        <select
          value={value}
          onChange={(e) => handleFilterChange(col.key, e.target.value, filterType)}
          className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#003087]/30 focus:border-[#003087] min-h-[28px]"
        >
          <option value="">Todos</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    return (
      <input
        type={filterType === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => handleFilterChange(col.key, e.target.value, filterType)}
        placeholder="Filtrar..."
        className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#003087]/30 focus:border-[#003087] min-h-[28px]"
      />
    )
  }, [localFilters, handleFilterChange])

  // -- Mobile card view --
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 p-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {onSearch && (
              <SearchField
                value={localSearch}
                onChange={handleSearchChange}
                className="relative flex-1"
              >
                <Label className="sr-only">{searchPlaceholder}</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
                <AriaInput
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </SearchField>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {hasFilterableColumns && (
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className={`relative p-2 rounded-lg border transition-colors ${
                    activeFilterCount > 0
                      ? 'border-[#003087] bg-[#003087]/10 text-[#003087]'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[10px] font-bold bg-[#003087] text-white rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}
              {actions}
              <ColumnSelector
                columns={columns}
                visibleKeys={visibleKeys}
                onChange={setVisibleKeys}
                storageKey={storageKey}
              />
              {onExport && (
                <ExportMenu onExport={onExport} formats={exportFormats} />
              )}
            </div>
          </div>

          {/* Mobile filter panel */}
          {showMobileFilters && hasFilterableColumns && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700 uppercase">Filtros</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              {visibleColumns
                .filter((c) => c.filterable)
                .map((col) => (
                  <div key={col.key}>
                    <label className="block text-xs text-gray-500 mb-0.5">{col.label}</label>
                    {renderFilterInput(col)}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                ))}
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Inbox className="w-10 h-10" />
                <p className="text-sm font-medium">No se encontraron registros</p>
              </div>
            </div>
          ) : (
            data.map((row, rowIdx) => (
              <React.Fragment key={rowIdx}>
                <div className="p-3 space-y-1.5">
                  {visibleColumns.map((col) => (
                    <div key={col.key} className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 font-medium shrink-0 w-24 pt-0.5">{col.label}</span>
                      <span className="text-sm text-gray-800 min-w-0 break-words">
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                      </span>
                    </div>
                  ))}
                </div>
                {renderCustomRow?.(row)}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-2 p-3 border-t border-gray-100 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-xs">
              {startRow}-{endRow} de {totalRows}
            </span>
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size} / pág</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 text-sm font-medium">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -- Desktop table view --
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        {onSearch && (
          <SearchField
            value={localSearch}
            onChange={handleSearchChange}
            className="relative flex-1 min-w-[200px] max-w-xs"
          >
            <Label className="sr-only">{searchPlaceholder}</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <AriaInput
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
          </SearchField>
        )}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
            <X className="w-3 h-3" />
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {actions}
          <ColumnSelector
            columns={columns}
            visibleKeys={visibleKeys}
            onChange={setVisibleKeys}
            storageKey={storageKey}
          />
          {onExport && (
            <ExportMenu onExport={onExport} formats={exportFormats} />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm data-grid-compact">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer select-none hover:text-gray-900' : ''
                  } ${col.className || ''} ${
                    col.stickyRight ? 'sticky right-0 bg-gray-50 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] border-l border-gray-100' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
            {hasFilterableColumns && (
              <tr className="border-b border-gray-100 bg-gray-50/30">
                {visibleColumns.map((col) => (
                  <th key={col.key} className={`px-3 py-1.5 ${
                    col.stickyRight ? 'sticky right-0 bg-gray-50 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] border-l border-gray-100' : ''
                  }`}>
                    {renderFilterInput(col)}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-gray-50">
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Inbox className="w-10 h-10" />
                    <p className="text-sm font-medium">No se encontraron registros</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <React.Fragment key={rowIdx}>
                  <DataGridRow
                    row={row}
                    visibleColumns={visibleColumns}
                    rowClassName={rowClassName ? rowClassName(row) : undefined}
                  />
                  {renderCustomRow?.(row)}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
        <span>
          Mostrando {startRow}-{endRow} de {totalRows}
        </span>
        <div className="flex items-center gap-3">
          {onPageSizeChange && (
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / página
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { Column, DataGridProps }
