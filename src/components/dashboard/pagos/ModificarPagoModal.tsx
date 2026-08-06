'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Pago } from '@/types'

interface ModificarPagoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  pago: Pago | null
}

export default function ModificarPagoModal({
  isOpen,
  onClose,
  onSuccess,
  pago,
}: ModificarPagoModalProps) {
  const [estado, setEstado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pago) {
      setEstado(pago.estado)
      setObservacion(pago.observacion || '')
    }
  }, [pago])

  if (!isOpen || !pago) return null

  const handleUpdate = async () => {
    setLoading(true)
    try {
      await api.patch(`/pagos/${pago.id}/estado`, {
        estado,
        observacion: observacion || null,
      })
      toast.success('Pago actualizado correctamente')
      onSuccess()
      onClose()
    } catch {
      toast.error('Error al actualizar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Modificar Pago #{pago.id}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            >
              <option value="pendiente">Pendiente</option>
              <option value="recibido">Recibido</option>
              <option value="acreditado">Acreditado</option>
              <option value="imputado_parcial">Imputado Parcial</option>
              <option value="imputado">Imputado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              placeholder="Agregar una observación..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  )
}
