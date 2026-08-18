'use client'

import { useState } from 'react'
import { Rocket, CheckCircle2, Clock, ChevronDown } from 'lucide-react'
import { RELEASES } from '@/lib/changelog'

const AREA_COLORS: Record<string, string> = {
  Clientes: 'bg-blue-100 text-blue-700',
  Productos: 'bg-emerald-100 text-emerald-700',
  Precios: 'bg-amber-100 text-amber-700',
  Comisiones: 'bg-purple-100 text-purple-700',
  Ventas: 'bg-rose-100 text-rose-700',
  Stock: 'bg-teal-100 text-teal-700',
  UI: 'bg-gray-100 text-gray-600',
  Infra: 'bg-slate-100 text-slate-600',
  Sistema: 'bg-[#003087]/10 text-[#003087]',
}

function formatFecha(fecha: string): string {
  // Acepta YYYY-MM-DD o texto libre (ej. "2026-08").
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(fecha)
  if (!m) return fecha
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mes = meses[parseInt(m[2], 10) - 1]
  return m[3] ? `${parseInt(m[3], 10)} ${mes} ${m[1]}` : `${mes} ${m[1]}`
}

export default function NovedadesPage() {
  // Sólo la release más reciente arranca abierta; el resto colapsadas.
  const [openVersion, setOpenVersion] = useState<string | null>(RELEASES[0]?.version ?? null)

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      {/* Header compacto */}
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-[#003087] rounded-lg shrink-0">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Novedades</h1>
          <p className="text-xs text-gray-500">Mejoras del sistema, versión por versión.</p>
        </div>
      </div>

      {/* Releases (acordeón) */}
      <div className="space-y-2.5">
        {RELEASES.map((release) => {
          const enCurso = release.estado === 'en_curso'
          const grupos = release.cambios.reduce((acc, c) => {
            (acc[c.area] ||= []).push(c.detalle)
            return acc
          }, {} as Record<string, string[]>)
          const areasOrdenadas = Object.keys(grupos).sort()
          const abierto = openVersion === release.version

          return (
            <div key={release.version} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenVersion(abierto ? null : release.version)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${enCurso ? 'bg-[#00AEEF]' : 'bg-[#003087]'}`}>
                  {enCurso ? <Clock className="w-3 h-3 text-white" /> : <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
                <span className="font-bold text-gray-900 text-sm shrink-0">{release.version}</span>
                {enCurso && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0086c3] bg-[#00AEEF]/10 rounded shrink-0">
                    En curso
                  </span>
                )}
                <span className="text-xs text-gray-500 truncate flex-1 min-w-0 hidden sm:block">{release.titulo}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{formatFecha(release.fecha)}</span>
                <span className="text-[10px] font-medium text-gray-400 shrink-0 tabular-nums">{release.cambios.length}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
              </button>

              {abierto && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-3 sm:hidden">{release.titulo}</p>
                  <div className="space-y-3">
                    {areasOrdenadas.map((area) => (
                      <div key={area}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${AREA_COLORS[area] || 'bg-gray-100 text-gray-600'}`}>
                            {area}
                          </span>
                          <div className="flex-1 h-px bg-gray-50" />
                        </div>
                        <ul className="space-y-1 pl-0.5">
                          {grupos[area].map((detalle, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600 leading-snug">
                              <span className="mt-[7px] w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                              <span>{detalle}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
