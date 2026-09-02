'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { TomaInventario, TomaInventarioLinea } from '@/types'

type Respuesta = TomaInventario & { items: TomaInventarioLinea[]; total: number }

export default function TomaInventarioPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [toma, setToma] = useState<Respuesta | null>(null)
  const [loading, setLoading] = useState(true)
  const [aplicando, setAplicando] = useState(false)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'sin_contar' | 'con_diferencia'>('todos')
  const busqueda = useDebounce(search, 400)
  // Lo tipeado que todavía no se guardó, por producto.
  const pendientes = useRef<Map<number, { cajas: number; blisters: number }>>(new Map())

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = { page_size: 300 }
      if (busqueda) params.search = busqueda
      if (filtro === 'sin_contar') params.solo_sin_contar = true
      if (filtro === 'con_diferencia') params.solo_con_diferencia = true
      const res = await api.get<Respuesta>(`/stock/inventarios/${id}`, { params })
      setToma(res.data)
    } catch {
      toast.error('No se pudo cargar el recuento')
    } finally {
      setLoading(false)
    }
  }, [id, busqueda, filtro])

  useEffect(() => { cargar() }, [cargar])

  /** Guarda lo tipeado. Devuelve false si no se pudo: lo pendiente se conserva. */
  const guardarPendientes = useCallback(async (): Promise<boolean> => {
    if (pendientes.current.size === 0) return true
    const enVuelo = new Map(pendientes.current)
    const items = Array.from(enVuelo.entries()).map(([producto_id, v]) => ({
      producto_id,
      contado_cajas: v.cajas,
      contado_blisters: v.blisters,
    }))
    try {
      await api.put(`/stock/inventarios/${id}/lineas`, { items })
      // Se borra sólo lo que efectivamente se guardó: si el usuario siguió
      // contando mientras viajaba el pedido, eso queda pendiente para la próxima.
      for (const [pid, v] of enVuelo) {
        const actual = pendientes.current.get(pid)
        if (actual && actual.cajas === v.cajas && actual.blisters === v.blisters) {
          pendientes.current.delete(pid)
        }
      }
      return true
    } catch {
      // No se limpia: perder un conteo de horas por un corte de red no es opción.
      toast.error('No se pudo guardar el conteo. Se reintenta solo; no cierres la pantalla.')
      return false
    }
  }, [id])

  // Autosave por bloque: el conteo de un depósito dura horas y perder lo tipeado
  // porque se cerró el navegador no es aceptable.
  useEffect(() => {
    const t = setInterval(guardarPendientes, 4000)
    return () => { clearInterval(t); guardarPendientes() }
  }, [guardarPendientes])

  const editable = toma?.estado === 'borrador'

  const anotar = (linea: TomaInventarioLinea, campo: 'cajas' | 'blisters', valor: string) => {
    const n = parseInt(valor, 10) || 0
    const actual = pendientes.current.get(linea.producto_id) || {
      cajas: linea.contado_cajas ?? 0,
      blisters: linea.contado_blisters ?? 0,
    }
    pendientes.current.set(linea.producto_id, { ...actual, [campo]: n })
  }

  const aplicar = async (confirmarMovidas = false) => {
    // Sin guardar no se aplica: si no, se aplicarían los conteos viejos del
    // servidor como si fueran lo que la persona acaba de contar.
    if (!(await guardarPendientes())) return
    setAplicando(true)
    try {
      const res = await api.post(`/stock/inventarios/${id}/aplicar`, {
        confirmar_movidas: confirmarMovidas,
      })
      toast.success(`${res.data.movimientos} diferencia(s) aplicadas`)
      router.push('/dashboard/stock/inventarios')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } }
      const detalle = e.response?.data?.detail || ''
      // Sólo el 409 por "se movieron" se puede forzar. El de "ya está aplicada"
      // no tiene reintento posible: confirmarlo repetía el mismo error.
      const seMovieron = e.response?.status === 409 && detalle.includes('se movieron')
      if (seMovieron && !confirmarMovidas) {
        if (window.confirm(`${detalle}\n\n¿Aplicar igual?`)) {
          setAplicando(false)
          return aplicar(true)
        }
        toast('No se aplicó nada.')
      } else {
        toast.error(detalle || 'No se pudo aplicar')
      }
    } finally {
      setAplicando(false)
    }
  }

  if (loading && !toma) return <p className="text-sm text-gray-400">Cargando…</p>
  if (!toma) return null

  const r = toma.resumen
  const inputCls = 'w-16 px-1.5 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 disabled:bg-gray-50'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              {toma.numero} · {toma.deposito_nombre}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Abrió {toma.creado_por_nombre} el {toma.fecha} · estado {toma.estado}
            </p>
          </div>
          {editable && (
            <button type="button" onClick={() => aplicar(false)} disabled={aplicando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003087] rounded-xl hover:bg-[#002569] disabled:opacity-50">
              {aplicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aplicar diferencias
            </button>
          )}
        </div>

        {r && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-center">
            {[
              ['Líneas', r.lineas],
              ['Contadas', r.contadas],
              ['Con diferencia', r.con_diferencia],
              ['Sobrantes (bl)', r.delta_positivo_blisters],
              ['Faltantes (bl)', r.delta_negativo_blisters],
            ].map(([label, valor]) => (
              <div key={label as string} className="rounded-xl bg-gray-50 border border-gray-100 p-2">
                <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
                <p className="text-sm font-bold text-gray-800">{valor}</p>
              </div>
            ))}
          </div>
        )}

        {r && r.movidas_durante_conteo > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {r.movidas_durante_conteo} producto(s) se movieron desde que empezó el conteo.
              Aplicar va a pisar esos movimientos con lo que dice el papel.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg flex-1 min-w-[200px]" />
        {(['todos', 'sin_contar', 'con_diferencia'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
              filtro === f ? 'border-[#003087] bg-[#003087]/5 text-[#003087]' : 'border-gray-200 text-gray-500'
            }`}>
            {f === 'todos' ? 'Todos' : f === 'sin_contar' ? 'Sin contar' : 'Con diferencia'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
              {['Código', 'Producto', 'Sistema', 'Reservado', 'Contado (cj)', 'Contado (bl)', 'Diferencia'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {toma.items.map((l) => (
              <tr key={l.producto_id}
                className={`border-b border-gray-50 ${l.movido_durante_conteo ? 'bg-amber-50/60' : ''}`}>
                <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{l.producto_codigo}</td>
                <td className="px-3 py-1.5 text-gray-700">{l.producto_nombre}</td>
                <td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">
                  {l.actual_cajas} cj + {l.actual_blisters} bl
                </td>
                <td className="px-3 py-1.5 text-xs text-amber-600">
                  {l.reservado_cajas > 0 ? `${l.reservado_cajas} cj` : '-'}
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" min={0} disabled={!editable} className={inputCls}
                    defaultValue={l.contado_cajas ?? ''} placeholder="—"
                    onChange={(e) => anotar(l, 'cajas', e.target.value)} />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" min={0} disabled={!editable} className={inputCls}
                    defaultValue={l.contado_blisters ?? ''} placeholder="—"
                    onChange={(e) => anotar(l, 'blisters', e.target.value)} />
                </td>
                <td className={`px-3 py-1.5 text-xs font-semibold ${
                  l.diferencia_blisters == null ? 'text-gray-300'
                    : l.diferencia_blisters === 0 ? 'text-gray-400'
                    : l.diferencia_blisters > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {l.diferencia_blisters == null ? '—' : `${l.diferencia_blisters > 0 ? '+' : ''}${l.diferencia_blisters} bl`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Mostrando {toma.items.length} de {toma.total} líneas. El conteo se guarda solo cada pocos segundos.
        No cuentes la mercadería ya apartada para despacho: es la columna &quot;Reservado&quot;.
      </p>
    </div>
  )
}
