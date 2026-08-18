'use client'

import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { mesesRecientes } from '@/lib/periodos'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Cantidad de meses recientes en el grupo "Por mes". */
  meses?: number
  className?: string
}

export default function PeriodoSelect({ value, onChange, meses = 18, className }: Props) {
  const opciones = useMemo(() => mesesRecientes(meses), [meses])

  return (
    <div className="inline-flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ||
          'px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] min-w-[170px]'
        }
      >
        <option value="hoy">Hoy</option>
        <option value="ayer">Ayer</option>
        <option value="semana">Última semana</option>
        <option value="mes">Último mes</option>
        <option value="anterior">Anterior</option>
        <option value="todos">Todos</option>
        <optgroup label="Por mes">
          {opciones.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
