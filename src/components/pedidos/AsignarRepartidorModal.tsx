'use client'

import { useState, useEffect } from 'react'
import { X, Search, User, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { User as UserType } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'

interface AsignarRepartidorModalProps {
  pedidoId: number
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AsignarRepartidorModal({
  pedidoId,
  isOpen,
  onClose,
  onSuccess,
}: AsignarRepartidorModalProps) {
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen, debouncedSearch])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = {
        search: debouncedSearch,
        page_size: 50,
      }
      const res = await api.get('/users', { params })
      // Filtramos para solo mostrar usuarios activos
      setUsers(res.data.items.filter((u: UserType) => u.activo))
    } catch {
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (userId: number) => {
    setAssigning(true)
    try {
      await api.post('/pedidos/asignar-repartidor', {
        pedido_ids: [pedidoId],
        repartidor_id: userId,
      })
      toast.success('Repartidor asignado correctamente')
      onSuccess()
      onClose()
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Error al asignar repartidor'
      toast.error(detail)
    } finally {
      setAssigning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Asignar Repartidor</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 flex flex-col min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {loading && users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#003087]" />
                <p className="text-sm">Buscando usuarios...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No se encontraron usuarios</p>
              </div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAssign(user.id)}
                  disabled={assigning}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors group text-left border border-transparent hover:border-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                      {user.nombre_completo.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-900">
                        {user.nombre_completo}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{user.rol}</p>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
