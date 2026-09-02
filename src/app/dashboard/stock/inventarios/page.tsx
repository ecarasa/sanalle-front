'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Deposito, TomaInventario } from '@/types'

const BADGE: Record<string, string> = {
  borrador: 'bg-amber-100 text-amber-700',
  aplicada: 'bg-green-100 text-green-700',
  anulada: 'bg-gray-100 text-gray-500',
}

export default function InventariosPage() {
  const [items, setItems] = useState<TomaInventario[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [loading, setLoading] = useState(true)
  const [abriendo, setAbriendo] = useState(false)
  const [nuevoDeposito, setNuevoDeposito] = useState('')
  const [soloConStock, setSoloConStock] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ items: TomaInventario[] }>('/stock/inventarios')
      setItems(res.data.items)
    } catch {
      toast.error('Error al cargar los inventarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    api.get<Deposito[]>('/depositos')
      .then((r) => {
        const activos = (r.data ?? []).filter((d) => d.activo)
        setDepositos(activos)
        setNuevoDeposito(activos[0] ? String(activos[0].id) : '')
      })
      .catch(() => {})
  }, [])

  const abrir = async () => {
    if (!nuevoDeposito) return
    setAbriendo(true)
    try {
      const res = await api.post<TomaInventario>('/stock/inventarios', {
        deposito_id: Number(nuevoDeposito),
        filtro: { solo_con_stock: soloConStock },
      })
      toast.success(`${res.data.numero}: ${res.data.total_lineas} productos a contar`)
      cargar()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'No se pudo abrir el inventario')
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-1">Abrir un recuento</h2>
        <p className="text-xs text-gray-500 mb-4">
          Se congela lo que el sistema cree tener y se carga lo contado. Las diferencias se
          aplican todas juntas al final.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Depósito</label>
            <select value={nuevoDeposito} onChange={(e) => setNuevoDeposito(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
              {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 pb-2">
            <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} />
            Solo productos con stock
          </label>
          <button type="button" onClick={abrir} disabled={abriendo || !nuevoDeposito}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003087] rounded-xl hover:bg-[#002569] disabled:opacity-50">
            {abriendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Abrir recuento
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
              {['Número', 'Depósito', 'Fecha', 'Estado', 'Abrió', 'Aplicó', ''].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                <ClipboardList className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                Todavía no se hizo ningún recuento.
              </td></tr>
            )}
            {items.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-2 font-mono text-xs text-gray-700">{t.numero}</td>
                <td className="px-3 py-2 text-gray-700">{t.deposito_nombre}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{t.fecha}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE[t.estado] || ''}`}>
                    {t.estado}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{t.creado_por_nombre}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{t.aplicado_por_nombre || '-'}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/dashboard/stock/inventarios/${t.id}`}
                    className="text-xs font-semibold text-[#003087] hover:underline">
                    {t.estado === 'borrador' ? 'Contar' : 'Ver'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
