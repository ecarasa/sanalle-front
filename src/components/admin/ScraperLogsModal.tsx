'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, RefreshCw, PlayCircle, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface ScraperRun {
  id: number
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  trigger: string
  status: string
  total: number
  updated: number
  skipped: number
  failed: number
  error_message: string | null
}

function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtDuracion(s: number | null): string {
  if (s == null) return '—'
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rest = Math.round(s % 60)
  return `${m}m ${rest}s`
}

export default function ScraperLogsModal({ onClose }: { onClose: () => void }) {
  const [runs, setRuns] = useState<ScraperRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/scraper/runs', { params: { limit: 100 } })
      setRuns((res.data ?? []) as ScraperRun[])
    } catch {
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const handleRun = async () => {
    setRunning(true)
    const t = toast.loading('Ejecutando scraper de PVP… (puede demorar)')
    try {
      const res = await api.post('/scraper/trigger-pvp-scrape')
      const { total = 0, updated = 0, skipped = 0, failed = 0 } = res.data || {}
      toast.success(
        `Listo: ${updated} con cambios, ${skipped} sin cambios, ${failed} fallidos (de ${total}).`,
        { id: t, duration: 7000 }
      )
      await fetchRuns()
    } catch {
      toast.error('No se pudo ejecutar el scraper.', { id: t })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">Logs del scraper de PVP</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Automático: todos los viernes 3:00 AM (hora Argentina) · fuente: alfabeta.net
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {running ? 'Ejecutando…' : 'Ejecutar ahora'}
            </button>
            <button
              type="button"
              onClick={fetchRuns}
              disabled={loading}
              title="Refrescar"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              Todavía no hay corridas registradas. Tocá <span className="font-semibold text-teal-600">Ejecutar ahora</span> para lanzar una.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Fecha</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Origen</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Estado</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Cambios</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Sin cambios</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Fallidos</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Total</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Duración</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50" title={r.error_message || undefined}>
                    <td className="px-3 py-2 text-gray-600">{fmtFechaHora(r.started_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.trigger === 'scheduled' ? 'bg-[#003087]/5 text-[#003087]' : 'bg-teal-50 text-teal-700'}`}>
                        {r.trigger === 'scheduled' ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">{r.updated}</td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{r.skipped}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.failed > 0 ? 'font-semibold text-amber-700' : 'text-gray-400'}`}>{r.failed}</td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{r.total}</td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmtDuracion(r.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
