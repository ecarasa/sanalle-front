'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Columns } from 'lucide-react'

interface Column {
  key: string
  label: string
  defaultVisible?: boolean
}

interface ColumnSelectorProps {
  columns: Column[]
  visibleKeys: string[]
  onChange: (visibleKeys: string[]) => void
  storageKey?: string
}

export default function ColumnSelector({
  columns,
  visibleKeys,
  onChange,
  storageKey,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleToggle = useCallback(
    (key: string) => {
      let next: string[]
      if (visibleKeys.includes(key)) {
        next = visibleKeys.filter((k) => k !== key)
      } else {
        next = [...visibleKeys, key]
      }
      onChange(next)
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // ignore storage errors
        }
      }
    },
    [visibleKeys, onChange, storageKey],
  )

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
      >
        <Columns className="w-4 h-4" />
        Columnas
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleKeys.includes(col.key)}
                onChange={() => handleToggle(col.key)}
                className="rounded border-gray-300 text-[#003087] focus:ring-[#003087]"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
