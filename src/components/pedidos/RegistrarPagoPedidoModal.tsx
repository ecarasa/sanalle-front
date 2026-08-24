'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, CreditCard, Loader2, ArrowLeftRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Pedido, Proveedor, PaginatedResponse } from '@/types'

interface Props {
  pedido: Pedido | null
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
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'retencion', label: 'Retención' },
]

// datetime-local en horario local (mismo patrón que otras pantallas de pagos).
function nowLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function RegistrarPagoPedidoModal({ pedido, open, onClose, onSuccess }: Props) {
  const [importe, setImporte] = useState('')
  const [tipoPago, setTipoPago] = useState('efectivo')
  const [fecha, setFecha] = useState(nowLocal())
  const [observacion, setObservacion] = useState('')
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [cuentaId, setCuentaId] = useState('')
  const [saving, setSaving] = useState(false)

  // Cuenta puente: el cobro se usa además para pagar a un proveedor (pasamanos).
  const [pagarProveedor, setPagarProveedor] = useState(false)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [importeProveedor, setImporteProveedor] = useState('')
  const [cuentaProveedor, setCuentaProveedor] = useState<'remito' | 'factura'>('remito')

  // Al abrir, precargar el importe con el saldo pendiente del pedido y traer las cuentas.
  useEffect(() => {
    if (open && pedido) {
      setImporte(pedido.saldo_pendiente > 0 ? String(pedido.saldo_pendiente) : '')
      setTipoPago('efectivo')
      setFecha(nowLocal())
      setObservacion('')
      setPagarProveedor(false)
      setProveedorId('')
      setImporteProveedor('')
      setCuentaProveedor('remito')
      api.get<Cuenta[]>('/cuentas')
        .then((res) => {
          setCuentas(res.data)
          const def = res.data.find((c) => c.es_default) || res.data[0]
          setCuentaId(def ? String(def.id) : '')
        })
        .catch(() => setCuentas([]))
    }
  }, [open, pedido])

  // Cargar proveedores al activar el toggle; default del importe = importe del cobro.
  useEffect(() => {
    if (!pagarProveedor) return
    setImporteProveedor((prev) => prev || importe)
    if (proveedores.length === 0) {
      api.get<PaginatedResponse<Proveedor>>('/proveedores', { params: { page_size: 1000 } })
        .then((res) => setProveedores(res.data.items))
        .catch(() => toast.error('No se pudieron cargar los proveedores'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagarProveedor])

  const proveedor = useMemo(
    () => proveedores.find((p) => String(p.id) === proveedorId) || null,
    [proveedores, proveedorId],
  )

  const importeNum = Number(importe)
  const importeProvNum = Number(importeProveedor)
  const puenteValido = !pagarProveedor || (!!proveedorId && importeProvNum > 0 && importeProvNum <= importeNum + 0.01)
  const valido = importeNum > 0 && puenteValido

  if (!open || !pedido) return null

  const handleSubmit = async () => {
    if (!valido) {
      toast.error(pagarProveedor ? 'Revisá el proveedor y el importe del pasamanos' : 'Ingresá un importe válido')
      return
    }
    setSaving(true)
    try {
      // Paso 1: crea el cobro e imputa al pedido. Si es puente, se marca es_puente.
      const isoFecha = new Date(fecha).toISOString()
      const res = await api.post<{ id: number }>(`/pagos/pedido/${pedido.id}`, {
        importe: importeNum,
        tipo_pago: tipoPago,
        fecha_recepcion: isoFecha,
        observacion: observacion.trim() || null,
        // Pasamanos: no queda asociado a ninguna cuenta real (es tránsito, no caja).
        cuenta_id: pagarProveedor ? null : (cuentaId ? Number(cuentaId) : null),
        es_puente: pagarProveedor,
      })

      // Paso 2 (opcional): paga al proveedor con ese cobro (pasamanos → tránsito).
      if (pagarProveedor && proveedorId) {
        await api.post('/pagos-proveedor', {
          proveedor_id: Number(proveedorId),
          importe: importeProvNum,
          fecha_pago: isoFecha,
          tipo_pago: tipoPago,
          tipo_cuenta: cuentaProveedor,
          pago_id: res.data.id,
          observacion: `Pasamanos desde pedido ${pedido.numero_pedido}`,
        })
      }

      toast.success(pagarProveedor ? 'Pago registrado y enviado al proveedor' : 'Pago registrado')
      onSuccess()
      onClose()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Error al registrar el pago')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Registrar pago</h2>
              <p className="text-xs text-gray-500">
                Pedido {pedido.numero_pedido} · {pedido.cliente_nombre ?? '-'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-500">Saldo pendiente</span>
            <span className={`font-bold ${pedido.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(pedido.saldo_pendiente)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Importe</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
            {importeNum > pedido.saldo_pendiente && pedido.saldo_pendiente > 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                El excedente ({formatCurrency(importeNum - pedido.saldo_pendiente)}) queda como saldo a favor del cliente.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
            <select
              value={tipoPago}
              onChange={(e) => setTipoPago(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            >
              {TIPOS_PAGO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {!pagarProveedor && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta</label>
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              >
                {cuentas.length === 0 && <option value="">(cuenta por defecto)</option>}
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.es_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observación (opcional)</label>
            <input
              type="text"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Nota del pago..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
          </div>

          {/* Cuenta puente: pagar a un proveedor con este cobro */}
          <div className="rounded-xl border border-gray-200 p-3">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <ArrowLeftRight className="w-4 h-4 text-[#00AEEF]" />
                Pagar a un proveedor (cuenta puente)
              </span>
              <input
                type="checkbox"
                checked={pagarProveedor}
                onChange={(e) => setPagarProveedor(e.target.checked)}
                className="w-4 h-4 accent-[#00AEEF]"
              />
            </label>
            <p className="text-[11px] text-gray-400 mt-1">
              La plata entra y sale (pasamanos): se registra como tránsito y no impacta la caja.
            </p>

            {pagarProveedor && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  >
                    <option value="">Elegí un proveedor...</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Importe al proveedor</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={importeProveedor}
                      onChange={(e) => setImporteProveedor(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta prov.</label>
                    <select
                      value={cuentaProveedor}
                      onChange={(e) => setCuentaProveedor(e.target.value as 'remito' | 'factura')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    >
                      <option value="remito">Remito</option>
                      <option value="factura">Factura</option>
                    </select>
                  </div>
                </div>
                {proveedor && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Saldo {cuentaProveedor} de {proveedor.nombre}</span>
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(cuentaProveedor === 'remito' ? proveedor.saldo_remito : proveedor.saldo_factura)}
                    </span>
                  </div>
                )}
                {importeProvNum > importeNum + 0.01 && (
                  <p className="text-[11px] text-red-600">
                    El pago al proveedor no puede superar el importe del cobro ({formatCurrency(importeNum)}).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valido || saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Registrar pago
          </button>
        </div>
      </div>
    </div>
  )
}
