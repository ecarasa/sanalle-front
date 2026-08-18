'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Pedido } from '@/types'
import PedidoForm from '@/components/pedidos/PedidoForm'

export default function EditarPedidoPage() {
  const router = useRouter()
  const params = useParams()
  const pedidoId = Number(params.id)

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPedido = async () => {
      try {
        const res = await api.get(`/pedidos/${pedidoId}`)
        const data = res.data
        if (data.shipping_status === 'entregado' || data.shipping_status === 'cancelado') {
          toast.error('No se pueden editar pedidos en estado "Entregado" o "Cancelado"')
          router.push('/dashboard/pedidos')
          return
        }
        setPedido(data)
      } catch {
        toast.error('Error al cargar el pedido')
        router.push('/dashboard/pedidos')
      } finally {
        setLoading(false)
      }
    }
    fetchPedido()
  }, [pedidoId, router])

  const handleCancel = () => {
    router.back()
  }

  if (loading || !pedido) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#003087]" />
        <p className="text-sm text-gray-500">Cargando pedido...</p>
      </div>
    )
  }

  // Format initial items correctly from the loaded data
  const initialItems = pedido.items?.map((item) => {
    const unidad: 'caja' | 'blister' = item.unidad_venta === 'blister' ? 'blister' : 'caja'
    // La cantidad mostrada es la de la unidad de venta de la línea.
    const cantidad = unidad === 'blister' ? (item.cantidad_blisters ?? 0) : (item.cantidad ?? item.cantidad_cajas ?? 0)
    return {
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre || 'Producto Desconocido',
      presentacion: item.presentacion || null,
      cantidad,
      unidad_venta: unidad,
      precio_lista: item.precio_lista ?? null,
      descuento_porcentaje: item.descuento_porcentaje ?? null,
      precio_unitario: item.precio_unitario,
      precio_total: item.precio_total,
      producto_precios: item.producto_precios ?? {},
      blisters_por_caja: item.blisters_por_caja ?? null,
    }
  }) || []

  return (
    <PedidoForm
      pedidoId={pedido.id}
      clienteNombre={pedido.cliente_nombre || 'Cliente Desconocido'}
      clienteTipo={pedido.cliente_tipo || undefined}
      numeroPedido={pedido.numero_pedido}
      vendedorNombre={pedido.vendedor_nombre || ''}
      initialVendedorId={pedido.vendedor_id}
      fechaCreacion={new Date(pedido.fecha).toLocaleDateString('es-AR')}
      initialFecha={pedido.fecha || null}
      initialTipoDocumento={pedido.tipo_documento || 'remito'}
      initialFechaEntrega={pedido.fecha_entrega || null}
      initialObservacion={pedido.observacion || ''}
      initialTransporte={pedido.transporte}
      initialDireccionEntrega={pedido.direccion_entrega}
      clienteDomicilio={pedido.cliente_domicilio}
      clienteLocalidad={pedido.cliente_localidad}
      clienteCodigoPostal={pedido.cliente_codigo_postal}
      clienteProvincia={pedido.cliente_provincia}
      initialSociedad={pedido.sociedad}
      initialFechaCompromisoPago={pedido.fecha_compromiso_pago}
      initialDespachado={pedido.despachado}
      initialTipoPrecio={pedido.tipo_precio}
      initialBultos={pedido.bultos}
      initialItems={initialItems}
      isEditing={true}
      onCancel={handleCancel}
    />
  )
}
