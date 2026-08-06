'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Plus, Trash2, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Pago, Pedido } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ImputacionLocal {
  pedido_id: number;
  numero_pedido: string;
  monto: number;
  saldo_pendiente_pedido: number;
}

interface ImputarPagoModalProps {
  tipo_pago: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  pago: Pago | null
  session: any
}

export default function ImputarPagoModal({
  isOpen,
  onClose,
  onSuccess,
  pago,
  session,
  tipo_pago
}: ImputarPagoModalProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [imputaciones, setImputaciones] = useState<ImputacionLocal[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [observacion, setObservacion] = useState('')

  const filteredPedidos = useMemo(() => {
    // Solo mostrar pedidos que no estén ya en la lista de imputaciones
    const alreadySelected = new Set(imputaciones.map(i => i.pedido_id))
    let available = pedidos.filter(p => !alreadySelected.has(p.id))

    if (tipo_pago !== 'efectivo') {
      available = available.filter((p: Pedido) => p.tipo_documento !== 'remito')
    }
    return available
  }, [pedidos, imputaciones, tipo_pago])

  useEffect(() => {
    if (isOpen && pago) {
      fetchPedidos()
      setImputaciones([])
      setObservacion('')
    }
  }, [isOpen, pago])

  const fetchPedidos = async () => {
    if (!pago) return
    setLoadingPedidos(true)
    try {
      const res = await api.get<{ pedidos: Pedido[] }>(`/pedidos/${pago.cliente_id}/pedidos_a_imputar`)
      const fetchedPedidos = res.data.pedidos
      setPedidos(fetchedPedidos)

      // Auto-add first valid pedido (oldest) if no imputations yet
      const firstValid = fetchedPedidos.find(p => 
        tipo_pago === 'efectivo' || p.tipo_documento !== 'remito'
      )

      if (firstValid) {
        const montoAImputar = Math.min(pago.saldo_restante, firstValid.saldo_pendiente)
        setImputaciones([{
          pedido_id: firstValid.id,
          numero_pedido: firstValid.numero_pedido,
          monto: montoAImputar > 0 ? montoAImputar : 0,
          saldo_pendiente_pedido: firstValid.saldo_pendiente
        }])
      }
    } catch {
      toast.error('Error al cargar pedidos pendientes')
    } finally {
      setLoadingPedidos(false)
    }
  }

  const handleAddPedido = (pedidoId: string) => {
    if (!pedidoId) return
    const pedido = pedidos.find(p => p.id === Number(pedidoId))
    if (!pedido) return

    // Por defecto, intentar imputar lo máximo posible
    const totalImputando = imputaciones.reduce((sum, i) => sum + i.monto, 0)
    const saldoDisponible = (pago?.saldo_restante || 0) - totalImputando
    const montoAImputar = Math.min(saldoDisponible, pedido.saldo_pendiente)

    setImputaciones([...imputaciones, {
      pedido_id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      monto: montoAImputar > 0 ? montoAImputar : 0,
      saldo_pendiente_pedido: pedido.saldo_pendiente
    }])
  }

  const handleRemoveImputacion = (pedidoId: number) => {
    setImputaciones(imputaciones.filter(i => i.pedido_id !== pedidoId))
  }

  const handleUpdateMonto = (pedidoId: number, newMonto: number) => {
    setImputaciones(imputaciones.map(i =>
      i.pedido_id === pedidoId ? { ...i, monto: newMonto } : i
    ))
  }

  const totalAImputar = useMemo(() =>
    imputaciones.reduce((sum, i) => sum + i.monto, 0)
    , [imputaciones])

  const saldoFinal = (pago?.saldo_restante || 0) - totalAImputar

  if (!isOpen || !pago) return null

  const handleImputar = async () => {
    if (imputaciones.length === 0) {
      toast.error('Debe seleccionar al menos un pedido')
      return
    }
    if (totalAImputar <= 0) {
      toast.error('El monto total a imputar debe ser mayor a 0')
      return
    }
    if (totalAImputar > pago.saldo_restante) {
      toast.error('No puede imputar más del saldo disponible del pago')
      return
    }

    setLoading(true)
    try {
      await api.post(`/pagos/${pago.id}/imputar`, {
        imputaciones: imputaciones.filter(i => i.monto > 0).map(i => ({
          pedido_id: i.pedido_id,
          monto: i.monto,
          observacion: observacion || null,
        })),
      })
      toast.success('Pago imputado correctamente')
      onSuccess()
      onClose()
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Error al imputar el pago'
      toast.error(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Imputar Pago #{pago.id}</h3>
            <p className="text-sm text-gray-500">{tipo_pago}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-600 uppercase font-bold mb-1">Saldo Disponible</p>
              <p className="text-xl font-black text-blue-900">{formatCurrency(pago.saldo_restante)}</p>
            </div>
            <div className={`p-3 rounded-xl border ${saldoFinal < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <p className={`text-xs uppercase font-bold mb-1 ${saldoFinal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Resto Final</p>
              <p className={`text-xl font-black ${saldoFinal < 0 ? 'text-red-900' : 'text-emerald-900'}`}>{formatCurrency(saldoFinal)}</p>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
            <p className="text-gray-600">Cliente: <span className="font-semibold text-gray-900">{pago.cliente_nombre || '-'}</span></p>
            <p className="text-gray-600">Importe Total Pago: <span className="font-semibold text-gray-900">{formatCurrency(pago.importe)}</span></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Añadir Pedido a Imputar</label>
            <div className="flex gap-2">
              <select
                value=""
                onChange={(e) => handleAddPedido(e.target.value)}
                disabled={loadingPedidos}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              >
                <option value="">{loadingPedidos ? 'Cargando...' : 'Seleccione un pedido...'}</option>
                {filteredPedidos.map((p: Pedido) => (
                  <option key={p.id} value={p.id}>
                    #{p.numero_pedido} - {formatDate(p.fecha)} - Saldo: {formatCurrency(p.saldo_pendiente)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-900 border-b pb-1">Pedidos a Imputar</h4>
            {imputaciones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed">
                No hay pedidos seleccionados
              </p>
            ) : (
              <div className="space-y-2">
                {imputaciones.map((imp) => (
                  <div key={imp.pedido_id} className="flex gap-3 items-end p-3 bg-white border rounded-lg shadow-sm">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-500 uppercase">Pedido #{imp.numero_pedido}</p>
                      <p className="text-[10px] text-gray-400">Saldo pendiente: {formatCurrency(imp.saldo_pendiente_pedido)}</p>
                    </div>
                    <div className="w-32">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Monto</label>
                      <input
                        type="number"
                        step="0.01"
                        value={imp.monto}
                        onChange={(e) => handleUpdateMonto(imp.pedido_id, Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveImputacion(imp.pedido_id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-xs uppercase">Observación General</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              placeholder="Ej: Pago de varias facturas..."
            />
          </div>
        </div>

        <div className="flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-2xl mt-4 flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Imputando: <strong>{formatCurrency(totalAImputar)}</strong>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImputar}
              disabled={loading || imputaciones.length === 0 || saldoFinal < 0}
              className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Procesar Imputación
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

