'use client'

import { useState } from 'react'
import { X, MapPin, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Pedido } from '@/types'

interface Props {
  pedido: Pedido
  onClose: () => void
  onSuccess: () => void
}

export default function EditarUbicacionModal({ pedido, onClose, onSuccess }: Props) {
  const [direccion, setDireccion] = useState(
    pedido.direccion_entrega || pedido.cliente_domicilio || ''
  )
  const [loading, setLoading] = useState(false)

  const handleGuardar = async () => {
    if (!direccion.trim()) return
    setLoading(true)
    try {
      await api.patch(`/pedidos/${pedido.id}/ubicacion`, { direccion: direccion.trim() })
      toast.success('Punto de entrega actualizado')
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Error al actualizar la ubicación'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            <h2 className="text-base font-bold">Cambiar punto de entrega</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500">
            Pedido <span className="font-semibold text-gray-800">{pedido.numero_pedido}</span>
            {' · '}{pedido.cliente_nombre}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nueva dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuardar()}
              placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Se geolocalizará automáticamente para actualizar el mapa.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading || !direccion.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Geolocalizando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
