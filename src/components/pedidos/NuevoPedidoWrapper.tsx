'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Cliente, Pedido } from '@/types'
import PedidoForm from '@/components/pedidos/PedidoForm'
import ClientSelector from '@/components/ui/ClientSelector'

interface NuevoPedidoWrapperProps {
  initialClienteId?: number
}

export default function NuevoPedidoWrapper({ initialClienteId }: NuevoPedidoWrapperProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [clienteId, setClienteId] = useState<number | null>(initialClienteId || null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [creatingDraft, setCreatingDraft] = useState(!!initialClienteId)
  
  const isInitializing = useRef(false)

  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  useEffect(() => {
    // If we have a client selected but no draft yet, create the draft.
    // If we change client (which shouldn't be possible once draft is created without unmounting, but just in case),
    // we would need to handle that. Here we assume once draft is created, it's locked.
    if (!clienteId || pedido || isInitializing.current) return
    isInitializing.current = true
    setCreatingDraft(true)

    const initDraft = async () => {
      try {
        const [clienteRes, pedidoRes] = await Promise.all([
          api.get<Cliente>(`/clientes/${clienteId}`),
          api.post<Pedido>('/pedidos', { cliente_id: clienteId, tipo_documento: 'remito', items: [] }),
        ])
        setCliente(clienteRes.data)
        setPedido(pedidoRes.data)
      } catch (err) {
        toast.error('Error al inicializar el pedido')
        router.push('/dashboard/pedidos')
      } finally {
        setCreatingDraft(false)
      }
    }
    initDraft()
  }, [clienteId, pedido, router])

  const handleCancel = async () => {
    if (pedido?.id) {
      try {
        await api.delete(`/pedidos/${pedido.id}`)
      } catch {
        // If delete fails, navigate anyway
      }
    }
    router.back()
  }

  if (!clienteId && !creatingDraft && !pedido) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo Pedido</h1>
            <p className="text-sm text-gray-500 mt-1">Selecciona un cliente para comenzar</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Seleccionar Cliente</h2>
          <ClientSelector 
            selectedClienteId={clienteId}
            onClientSelect={setClienteId}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          Seleccione un cliente para crear el borrador del pedido
        </div>
      </div>
    )
  }

  if (creatingDraft || !pedido || !cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#003087]" />
        <p className="text-sm text-gray-500">Iniciando pedido...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Show disabled ClientSelector for consistency if we want to show it. But PedidoForm already has a nice header with the client name.
          We can just render the PedidoForm. */}
      <PedidoForm
        pedidoId={pedido.id}
        clienteNombre={cliente.nombre}
        clienteTipo={cliente.tipo}
        clienteCondicionPago={cliente.condicion_pago}
        clientePlazoDias={cliente.plazo_dias}
        clienteDiasEntrega={cliente.dias_entrega}
        clienteDomicilio={cliente.domicilio}
        clienteLocalidad={cliente.localidad_nombre}
        clienteCodigoPostal={cliente.localidad_codigo_postal}
        clienteProvincia={cliente.localidad_provincia}
        numeroPedido={pedido.numero_pedido}
        vendedorNombre={user?.nombre_completo || user?.username || ''}
        initialVendedorId={user?.id}
        fechaCreacion={today}
        initialFecha={pedido.fecha || null}
        initialTipoDocumento={pedido.tipo_documento || 'remito'}
        initialFechaEntrega={pedido.fecha_entrega || null}
        initialObservacion={pedido.observacion || ''}
        initialTipoPrecio={pedido.tipo_precio}
        initialSociedad={pedido.sociedad || 'sanalle'}
        initialBultos={pedido.bultos}
        initialItems={[]}
        isEditing={false}
        onCancel={handleCancel}
      />
    </div>
  )
}
