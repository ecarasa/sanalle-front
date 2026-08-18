'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Banknote, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Proveedor, PaginatedResponse, PagoPendienteInfo } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Cuenta {
  id: number
  nombre: string
  tipo: string
  es_default: boolean
}

const TIPOS_PAGO = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'retencion', label: 'Retención' },
]

function nowLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function RegistrarPagoProveedorModal({ open, onClose, onSuccess }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [importe, setImporte] = useState('')
  const [tipoPago, setTipoPago] = useState('transferencia')
  const [fecha, setFecha] = useState(nowLocal())
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [saving, setSaving] = useState(false)

  // Comprobantes pendientes del proveedor (opcional) para imputar el pago.
  const [ingresos, setIngresos] = useState<PagoPendienteInfo[]>([])
  const [loadingIngresos, setLoadingIngresos] = useState(false)
  const [seleccion, setSeleccion] = useState<Record<number, string>>({}) // id -> monto

  useEffect(() => {
    if (!open) return
    setProveedorId('')
    setImporte('')
    setTipoPago('transferencia')
    setFecha(nowLocal())
    setReferencia('')
    setObservacion('')
    setIngresos([])
    setSeleccion({})
    api.get<PaginatedResponse<Proveedor>>('/proveedores', { params: { page_size: 1000 } })
      .then((res) => setProveedores(res.data.items))
      .catch(() => toast.error('No se pudieron cargar los proveedores'))
    api.get<Cuenta[]>('/cuentas')
      .then((res) => {
        setCuentas(res.data)
        const def = res.data.find((c) => c.es_default) || res.data[0]
        setCuentaId(def ? String(def.id) : '')
      })
      .catch(() => setCuentas([]))
  }, [open])

  // Al elegir proveedor, traer sus comprobantes pendientes.
  useEffect(() => {
    if (!open || !proveedorId) { setIngresos([]); setSeleccion({}); return }
    setLoadingIngresos(true)
    api.get<PagoPendienteInfo[]>(`/proveedores/${proveedorId}/ingresos-pendientes`)
      .then((res) => setIngresos(res.data))
      .catch(() => setIngresos([]))
      .finally(() => setLoadingIngresos(false))
    setSeleccion({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId, open])

  const proveedor = useMemo(
    () => proveedores.find((p) => String(p.id) === proveedorId) || null,
    [proveedores, proveedorId],
  )

  const idsSeleccionados = Object.keys(seleccion).map(Number)
  const usaComprobantes = idsSeleccionados.length > 0
  const totalComprobantes = useMemo(
    () => idsSeleccionados.reduce((s, id) => s + (parseFloat(seleccion[id] || '0') || 0), 0),
    [seleccion, idsSeleccionados],
  )

  const saldoProveedor = proveedor
    ? (proveedor.saldo_remito || 0) + (proveedor.saldo_factura || 0)
    : null

  const toggleIngreso = (ing: PagoPendienteInfo) => {
    setSeleccion((prev) => {
      const next = { ...prev }
      if (next[ing.id] !== undefined) {
        delete next[ing.id]
      } else {
        next[ing.id] = String(ing.saldo_pendiente)
      }
      return next
    })
  }

  if (!open) return null

  const importeNum = usaComprobantes ? totalComprobantes : Number(importe)
  const valido = !!proveedorId && importeNum > 0

  const handleSubmit = async () => {
    if (!valido) {
      toast.error('Elegí un proveedor y un importe válido')
      return
    }
    setSaving(true)
    try {
      if (usaComprobantes) {
        // Flujo con imputación a comprobantes pendientes.
        await api.post(`/proveedores/${proveedorId}/pagar`, {
          ingresos: idsSeleccionados.map((id) => ({ id, monto: parseFloat(seleccion[id] || '0') })),
          metodo_pago: tipoPago,
          aplicar_descuento: false,
          aplicar_cashback: false,
          cuenta_id: cuentaId ? Number(cuentaId) : null,
          fecha: new Date(fecha).toISOString(),
        })
      } else {
        // Pago simple (transferencia que sale, sin imputar a comprobantes).
        await api.post('/pagos-proveedor', {
          proveedor_id: Number(proveedorId),
          importe: importeNum,
          fecha_pago: new Date(fecha).toISOString(),
          tipo_pago: tipoPago,
          tipo_cuenta: 'remito',
          cuenta_id: cuentaId ? Number(cuentaId) : null,
          referencia_pago: referencia.trim() || null,
          observacion: observacion.trim() || null,
        })
      }
      toast.success('Pago a proveedor registrado')
      onSuccess()
      onClose()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Error al registrar el pago')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-100">
              <Banknote className="w-5 h-5 text-[#E31837]" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Registrar pago a proveedor</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={inputCls}>
                <option value="">Elegí un proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta (de donde sale)</label>
              <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className={inputCls}>
                {cuentas.length === 0 && <option value="">(cuenta por defecto)</option>}
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.es_default ? ' (default)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
              <select value={tipoPago} onChange={(e) => setTipoPago(e.target.value)} className={inputCls}>
                {TIPOS_PAGO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Comprobantes pendientes (opcional) */}
          {proveedorId && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Comprobantes pendientes <span className="font-normal text-gray-400">(opcional)</span></span>
                {usaComprobantes && (
                  <span className="text-xs font-semibold text-[#E31837]">{formatCurrency(totalComprobantes)}</span>
                )}
              </div>
              {loadingIngresos ? (
                <div className="flex items-center justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : ingresos.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">No hay comprobantes pendientes.</div>
              ) : (
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
                  {ingresos.map((ing) => {
                    const checked = seleccion[ing.id] !== undefined
                    return (
                      <div key={ing.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <input type="checkbox" checked={checked} onChange={() => toggleIngreso(ing)} className="w-4 h-4 accent-[#E31837] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">{ing.numero_comprobante || ing.numero}</p>
                          <p className="text-[11px] text-gray-400">Saldo {formatCurrency(ing.saldo_pendiente)}</p>
                        </div>
                        {checked && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={ing.saldo_pendiente}
                            value={seleccion[ing.id]}
                            onChange={(e) => setSeleccion((prev) => ({ ...prev, [ing.id]: e.target.value }))}
                            className="w-28 px-2 py-1 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-[#003087]/20"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Importe libre — sólo cuando NO se imputa a comprobantes */}
          {!usaComprobantes && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Importe</label>
                <input type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(e.target.value)} className={inputCls.replace(' bg-white', '')} />
              </div>
              {saldoProveedor !== null && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Saldo con {proveedor?.nombre}</span>
                  <span className="font-semibold text-gray-700">{formatCurrency(saldoProveedor)}</span>
                </div>
              )}
            </div>
          )}

          {!usaComprobantes && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Referencia (opcional)</label>
                <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° transferencia / cheque..." className={inputCls.replace(' bg-white', '')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observación (opcional)</label>
                <input type="text" value={observacion} onChange={(e) => setObservacion(e.target.value)} className={inputCls.replace(' bg-white', '')} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <span className="text-sm text-gray-500">
            Total: <span className="font-bold text-[#E31837]">{formatCurrency(importeNum || 0)}</span>
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!valido || saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#E31837] rounded-lg hover:bg-[#c01530] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              Registrar pago
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
