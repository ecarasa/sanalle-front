'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpDown, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface HistorialProducto {
  id: number
  codigo: string
  nombre: string
}

interface PvpRow {
  id: number
  fecha_cambio: string
  pvp_anterior: number | null
  pvp_nuevo: number
  variacion_porcentaje: number | null
}

interface MovimientoRow {
  id: number
  tipo_operacion: string
  origen: string | null
  destino: string | null
  cantidad_cajas: number
  cantidad_blisters: number
  observacion: string | null
  created_at: string
  usuario_nombre: string | null
}

function fmtFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const TIPO_LABEL: Record<string, string> = {
  TRANSFER: 'Transferencia',
  FRACTION: 'Fraccionamiento',
  ADJUST: 'Ajuste',
}

const ORIGEN_LABEL: Record<string, string> = {
  STOCK_A: 'Stock A',
  STOCK_B: 'Stock B',
  NONE: '—',
}

interface ScraperLogRow {
  fecha: string
  trigger: string
  resultado: string // updated | skipped | failed
  pvp_anterior: number | null
  pvp_traido: number | null
  detalle: string | null
}

const RESULTADO_BADGE: Record<string, { label: string; cls: string }> = {
  updated: { label: 'Actualizado', cls: 'bg-green-50 text-green-700' },
  skipped: { label: 'Sin cambios', cls: 'bg-blue-50 text-blue-700' },
  failed: { label: 'Fallido', cls: 'bg-red-50 text-red-700' },
}

function VariacionBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="text-gray-300">—</span>
  const up = v > 0
  const flat = v === 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const cls = flat
    ? 'text-gray-500 bg-gray-100'
    : up
      ? 'text-amber-700 bg-amber-50'
      : 'text-green-700 bg-green-50'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {v > 0 ? '+' : ''}{v.toFixed(1)}%
    </span>
  )
}

export default function ProductoHistorialModal({
  producto,
  onClose,
}: {
  producto: HistorialProducto
  onClose: () => void
}) {
  const [tab, setTab] = useState<'pvp' | 'stock' | 'scraper'>('pvp')
  const [pvpRows, setPvpRows] = useState<PvpRow[]>([])
  const [stockRows, setStockRows] = useState<MovimientoRow[]>([])
  const [scraperLog, setScraperLog] = useState<ScraperLogRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [pvpRes, stockRes, logRes] = await Promise.all([
        api.get('/reportes/historial-pvp', { params: { search: producto.codigo } }),
        api.get('/movimientos-stock', { params: { producto_id: producto.id, page_size: 100 } }),
        api.get(`/scraper/producto/${producto.id}/log`, { params: { limit: 100 } }).catch(() => ({ data: [] })),
      ])
      const match = (pvpRes.data as { producto_id: number; historial: PvpRow[] }[])
        .find((p) => p.producto_id === producto.id)
      setPvpRows(match?.historial ?? [])
      setStockRows((stockRes.data?.items ?? []) as MovimientoRow[])
      setScraperLog((logRes.data ?? []) as ScraperLogRow[])
    } catch {
      setPvpRows([])
      setStockRows([])
      setScraperLog([])
    } finally {
      setLoading(false)
    }
  }, [producto.id, producto.codigo])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-gray-900">
              Historial de actualizaciones
            </h2>
            <p className="mt-0.5 truncate text-sm text-gray-500">
              <span className="font-mono text-xs text-gray-400">{producto.codigo}</span>
              {'  ·  '}{producto.nombre}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 px-4">
          {([
            { key: 'pvp', label: 'Precios (PVP)', icon: DollarSign },
            { key: 'scraper', label: 'Scraper (log)', icon: RefreshCw },
            { key: 'stock', label: 'Movimientos de stock', icon: ArrowUpDown },
          ] as const).map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${active
                  ? 'border-[#00AEEF] text-[#003087]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tab === 'pvp' ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-400">
                  Cambios de PVP (incluye los del scraper semanal de alfabeta.net). Más reciente primero.
                </p>
                {pvpRows.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#003087]/5 px-3 py-1 text-xs font-semibold text-[#003087]">
                    Última actualización: {fmtFechaHora(pvpRows[0].fecha_cambio)}
                  </span>
                )}
              </div>
              {pvpRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">Sin cambios de PVP registrados.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Fecha</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">PVP anterior</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">PVP nuevo</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pvpRows.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-600">{fmtFechaHora(r.fecha_cambio)}</td>
                        <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.pvp_anterior != null ? formatCurrency(r.pvp_anterior) : '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(r.pvp_nuevo)}</td>
                        <td className="px-3 py-2 text-right"><VariacionBadge v={r.variacion_porcentaje} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : tab === 'stock' ? (
            <>
              <p className="mb-3 text-xs text-gray-400">
                Movimientos de stock (transferencias, fraccionamientos y ajustes). Más reciente primero.
              </p>
              {stockRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">Sin movimientos de stock registrados.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Fecha</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Operación</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Origen → Destino</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Cantidad</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((m) => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-600">{fmtFechaHora(m.created_at)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded-full bg-[#003087]/5 px-2 py-0.5 text-xs font-medium text-[#003087]">
                            {TIPO_LABEL[m.tipo_operacion] || m.tipo_operacion}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {(ORIGEN_LABEL[m.origen || 'NONE'] || m.origen || '—')} → {(ORIGEN_LABEL[m.destino || 'NONE'] || m.destino || '—')}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                          {m.cantidad_cajas} cj{m.cantidad_blisters > 0 ? ` +${m.cantidad_blisters} bl` : ''}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{m.usuario_nombre || 'Sistema'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-400">
                Registro del scraper: cada verificación del PVP en alfabeta.net, aunque el precio no haya cambiado. Más reciente primero.
              </p>
              {scraperLog.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">Todavía no hay verificaciones del scraper para este producto.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Fecha</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Origen</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Resultado</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">PVP traído</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scraperLog.map((r, i) => {
                      const rb = RESULTADO_BADGE[r.resultado] || { label: r.resultado, cls: 'bg-gray-100 text-gray-600' }
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50" title={r.detalle || undefined}>
                          <td className="px-3 py-2 text-gray-600">{fmtFechaHora(r.fecha)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.trigger === 'scheduled' ? 'bg-[#003087]/5 text-[#003087]' : 'bg-teal-50 text-teal-700'}`}>
                              {r.trigger === 'scheduled' ? 'Automático' : 'Manual'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${rb.cls}`}>{rb.label}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">{r.pvp_traido != null ? formatCurrency(r.pvp_traido) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
