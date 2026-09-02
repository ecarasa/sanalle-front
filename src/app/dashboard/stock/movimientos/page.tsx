'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { Deposito, MotivoAjuste } from '@/types'

interface Movimiento {
  id: number
  tipo_operacion: string
  motivo: string | null
  motivo_label: string | null
  toma_numero: string | null
  producto_nombre: string | null
  usuario_nombre: string | null
  deposito_origen_nombre: string | null
  deposito_destino_nombre: string | null
  cantidad_cajas: number
  cantidad_blisters: number
  observacion: string | null
  created_at: string
}

const TIPOS = ['ADJUST', 'TRANSFER', 'INGRESO', 'NC_RETURN', 'ND_ADJUST']

export default function MovimientosStockPage() {
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [soloMermas, setSoloMermas] = useState(false)
  const [depositoId, setDepositoId] = useState('')
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [motivos, setMotivos] = useState<MotivoAjuste[]>([])
  const [items, setItems] = useState<Movimiento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const busqueda = useDebounce(search, 400)

  useEffect(() => {
    api.get<Deposito[]>('/depositos').then((r) => setDepositos(r.data ?? [])).catch(() => {})
    api.get<MotivoAjuste[]>('/stock/motivos-ajuste').then((r) => setMotivos(r.data)).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = { page, page_size: 50 }
      if (busqueda) params.search = busqueda
      if (tipo) params.tipo_operacion = tipo
      if (motivo) params.motivo = motivo
      if (soloMermas) params.solo_mermas = true
      if (depositoId) params.deposito_id = depositoId
      const res = await api.get<{ items: Movimiento[]; total: number }>('/movimientos-stock', { params })
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar los movimientos')
    } finally {
      setLoading(false)
    }
  }, [busqueda, tipo, motivo, soloMermas, depositoId, page])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPage(1) }, [busqueda, tipo, motivo, soloMermas, depositoId])

  const selectCls = 'px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por producto..."
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg flex-1 min-w-[200px]"
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
          <option value="">Todas las operaciones</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={selectCls}>
          <option value="">Todos los motivos</option>
          {motivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.label}</option>)}
        </select>
        <select value={depositoId} onChange={(e) => setDepositoId(e.target.value)} className={selectCls}>
          <option value="">Todos los depósitos</option>
          {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={soloMermas} onChange={(e) => setSoloMermas(e.target.checked)} />
          Solo mermas
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
              {['Fecha', 'Producto', 'Operación', 'Motivo', 'Movimiento', 'Cantidad', 'Usuario', 'Detalle'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No hay movimientos con estos filtros.</td></tr>
            )}
            {items.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(m.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2 text-gray-700">{m.producto_nombre}</td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-600">{m.tipo_operacion}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{m.motivo_label || '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {m.deposito_origen_nombre || '—'} → {m.deposito_destino_nombre || '—'}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-800 whitespace-nowrap">
                  {/* Los movimientos viejos guardaban el signo en la cantidad; la
                      dirección la da origen/destino, así que se muestra en positivo. */}
                  {Math.abs(m.cantidad_cajas)} cj{m.cantidad_blisters ? ` + ${Math.abs(m.cantidad_blisters)} bl` : ''}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{m.usuario_nombre}</td>
                <td className="px-3 py-2 text-xs text-gray-400">
                  {m.toma_numero && <span className="font-semibold text-[#003087]">{m.toma_numero} </span>}
                  {m.observacion}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{total} movimiento(s)</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40">Anterior</button>
          <button type="button" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40">Siguiente</button>
        </div>
      </div>
    </div>
  )
}
