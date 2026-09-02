'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Deposito, MotivoAjuste } from '@/types'

interface Resultado {
  aplicados?: number
  sin_cambio?: number
  updated?: number
  errors: string[]
  total_errores: number
}

async function descargar(url: string, params: Record<string, string | number>, nombre: string) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = nombre
  a.click()
  URL.revokeObjectURL(href)
}

export default function ImportarStockPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [motivos, setMotivos] = useState<MotivoAjuste[]>([])
  const [depositoId, setDepositoId] = useState('')
  const [motivo, setMotivo] = useState('carga_inicial')
  const [modo, setModo] = useState<'absoluto' | 'delta'>('absoluto')
  const [subiendo, setSubiendo] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [resultadoMinimos, setResultadoMinimos] = useState<Resultado | null>(null)
  const stockRef = useRef<HTMLInputElement>(null)
  const minimosRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<Deposito[]>('/depositos')
      .then((r) => setDepositos((r.data ?? []).filter((d) => d.activo)))
      .catch(() => {})
    api.get<MotivoAjuste[]>('/stock/motivos-ajuste').then((r) => setMotivos(r.data)).catch(() => {})
  }, [])

  const subirStock = async (file: File) => {
    setSubiendo(true)
    setResultado(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('motivo', motivo)
      form.append('modo', modo)
      const res = await api.post<Resultado>('/stock/import-excel', form)
      setResultado(res.data)
      if (res.data.total_errores > 0) {
        toast.error(`La planilla tiene ${res.data.total_errores} error(es): no se aplicó nada`)
      } else {
        toast.success(`${res.data.aplicados} producto(s) actualizados`)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Error al importar')
    } finally {
      setSubiendo(false)
      if (stockRef.current) stockRef.current.value = ''
    }
  }

  const subirMinimos = async (file: File) => {
    setSubiendo(true)
    setResultadoMinimos(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<Resultado>('/stock/minimos-excel', form)
      setResultadoMinimos(res.data)
      toast.success(`${res.data.updated} producto(s) con mínimo actualizado`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Error al importar')
    } finally {
      setSubiendo(false)
      if (minimosRef.current) minimosRef.current.value = ''
    }
  }

  const tarjeta = 'bg-white rounded-2xl border border-gray-200/60 p-5 space-y-4'
  const boton = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors'

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={tarjeta}>
        <div>
          <h2 className="text-sm font-bold text-gray-800">Carga de existencias</h2>
          <p className="text-xs text-gray-500 mt-1">
            Para arrancar con un depósito que ya tiene mercadería. Cada fila deja su movimiento,
            así queda registrado de dónde salió el stock.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Depósito de la plantilla</label>
            <select value={depositoId} onChange={(e) => setDepositoId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
              <option value="">Plantilla vacía</option>
              {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Motivo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
              {motivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Qué significan las cantidades</label>
          <div className="flex gap-2">
            {(['absoluto', 'delta'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                  modo === m ? 'border-[#003087] bg-[#003087]/5 text-[#003087]' : 'border-gray-200 text-gray-500'
                }`}>
                {m === 'absoluto' ? 'Es lo que hay' : 'Sumar / restar'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => descargar('/stock/import-template',
            depositoId ? { deposito_id: depositoId } : {}, 'plantilla-stock.xlsx')}
            className={`${boton} text-[#003087] bg-[#003087]/10 hover:bg-[#003087]/20`}>
            <Download className="w-4 h-4" /> Bajar plantilla
          </button>
          <button type="button" disabled={subiendo} onClick={() => stockRef.current?.click()}
            className={`${boton} text-white bg-[#00AEEF] hover:bg-[#0098d4] disabled:opacity-50`}>
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Subir planilla
          </button>
          <input ref={stockRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirStock(f) }} />
        </div>

        {resultado && (
          <div className="text-sm">
            {resultado.total_errores > 0 ? (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="font-semibold text-red-700">
                  No se aplicó nada: la planilla tiene {resultado.total_errores} error(es).
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                  {resultado.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-green-700 text-xs">
                {resultado.aplicados} producto(s) actualizados
                {resultado.sin_cambio ? `, ${resultado.sin_cambio} ya estaban en ese valor` : ''}.
              </div>
            )}
          </div>
        )}
      </div>

      <div className={tarjeta}>
        <div>
          <h2 className="text-sm font-bold text-gray-800">Mínimos de reposición</h2>
          <p className="text-xs text-gray-500 mt-1">
            El semáforo de stock no puede pintar nada hasta que los productos tengan mínimo.
            Bajá la planilla con los valores actuales, editala y volvé a subirla.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => descargar('/stock/minimos-excel', {}, 'minimos.xlsx')}
            className={`${boton} text-[#003087] bg-[#003087]/10 hover:bg-[#003087]/20`}>
            <Download className="w-4 h-4" /> Bajar mínimos actuales
          </button>
          <button type="button" disabled={subiendo} onClick={() => minimosRef.current?.click()}
            className={`${boton} text-white bg-[#00AEEF] hover:bg-[#0098d4] disabled:opacity-50`}>
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Subir mínimos
          </button>
          <input ref={minimosRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirMinimos(f) }} />
        </div>

        {resultadoMinimos && (
          <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-green-700 text-xs">
            {resultadoMinimos.updated} producto(s) con mínimo actualizado
            {resultadoMinimos.total_errores > 0 && (
              <ul className="mt-1 space-y-0.5 text-red-600">
                {resultadoMinimos.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
