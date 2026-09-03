'use client'

import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'

interface CambioProducto {
  id: number
  producto_id: number
  producto_codigo: string | null
  producto_nombre: string | null
  usuario_nombre: string
  accion: 'alta' | 'modificacion' | 'baja'
  origen: string
  campo: string | null
  campo_label: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  observacion: string | null
  created_at: string
}

const ACCION_BADGE: Record<string, string> = {
  alta: 'bg-green-100 text-green-700',
  modificacion: 'bg-blue-100 text-blue-700',
  baja: 'bg-red-100 text-red-700',
}

const ORIGEN_LABEL: Record<string, string> = {
  ficha: 'Ficha del producto',
  minimos: 'Mínimos',
  precios_masivo: 'Precios masivos',
  import: 'Importación',
}

export default function CambiosProductoPage() {
  const [search, setSearch] = useState('')
  const [campo, setCampo] = useState('')
  const [origen, setOrigen] = useState('')
  const [accion, setAccion] = useState('')
  const [campos, setCampos] = useState<{ campo: string; label: string }[]>([])
  const [items, setItems] = useState<CambioProducto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const busqueda = useDebounce(search, 400)

  useEffect(() => {
    api.get<{ campo: string; label: string }[]>('/stock/cambios-producto/campos')
      .then((r) => setCampos(r.data))
      .catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: 50 }
      if (busqueda) params.search = busqueda
      if (campo) params.campo = campo
      if (origen) params.origen = origen
      if (accion) params.accion = accion
      const res = await api.get<{ items: CambioProducto[]; total: number }>(
        '/stock/cambios-producto', { params }
      )
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar los cambios')
    } finally {
      setLoading(false)
    }
  }, [busqueda, campo, origen, accion, page])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPage(1) }, [busqueda, campo, origen, accion])

  const selectCls = 'px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white'

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Cambios en la ficha del producto: precio, mínimo, categoría. Las cantidades
        de stock se auditan aparte, en la pestaña Movimientos.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por producto, código o usuario..."
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg flex-1 min-w-[220px]"
        />
        <select value={campo} onChange={(e) => setCampo(e.target.value)} className={selectCls}>
          <option value="">Todos los campos</option>
          {campos.map((c) => <option key={c.campo} value={c.campo}>{c.label}</option>)}
        </select>
        <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={selectCls}>
          <option value="">Todos los orígenes</option>
          {Object.entries(ORIGEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={accion} onChange={(e) => setAccion(e.target.value)} className={selectCls}>
          <option value="">Alta, cambio y baja</option>
          <option value="alta">Altas</option>
          <option value="modificacion">Cambios</option>
          <option value="baja">Bajas</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
              {['Fecha', 'Producto', 'Qué pasó', 'Campo', 'Antes', 'Después', 'Quién', 'Origen'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                <History className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                Todavía no hay cambios registrados con estos filtros.
              </td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(c.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  <span className="font-mono text-xs text-gray-400 mr-1.5">{c.producto_codigo}</span>
                  {c.producto_nombre}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACCION_BADGE[c.accion] || ''}`}>
                    {c.accion === 'modificacion' ? 'cambio' : c.accion}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.campo_label || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-400 line-through">{c.valor_anterior ?? '—'}</td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-800">{c.valor_nuevo ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{c.usuario_nombre}</td>
                <td className="px-3 py-2 text-xs text-gray-400">
                  {ORIGEN_LABEL[c.origen] || c.origen}
                  {c.observacion && <span className="block text-[10px]">{c.observacion}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{total} cambio(s)</span>
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
