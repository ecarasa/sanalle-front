'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Printer,
  Code,
} from 'lucide-react'

interface ExportMenuProps {
  onExport: (format: string) => void
  formats?: string[]
}

const FORMAT_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  pdf: { label: 'PDF', icon: FileText },
  excel: { label: 'Excel', icon: FileSpreadsheet },
  word: { label: 'Word', icon: File },
  csv: { label: 'CSV', icon: FileText },
  xml: { label: 'XML', icon: Code },
  rtf: { label: 'RTF', icon: File },
  json: { label: 'JSON', icon: Code },
  print: { label: 'Imprimir', icon: Printer },
}

const DEFAULT_FORMATS = ['pdf', 'excel', 'word', 'csv', 'xml', 'rtf', 'json', 'print']

export default function ExportMenu({ onExport, formats = DEFAULT_FORMATS }: ExportMenuProps) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
      >
        <Download className="w-4 h-4" />
        Exportar
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {formats.map((format) => {
            const config = FORMAT_CONFIG[format]
            if (!config) return null
            const Icon = config.icon
            return (
              <button
                key={format}
                type="button"
                onClick={() => {
                  onExport(format)
                  setOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-500" />
                {config.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
