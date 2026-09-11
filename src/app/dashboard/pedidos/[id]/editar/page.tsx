'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Pedido } from '@/types'
import PedidoForm from '@/components/pedidos/PedidoForm'

/** Estados en los que el pedido todavía es de ventas y se puede modificar. */
const ESTADOS_EDITABLES = ['borrador', 'pendiente']

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Cotización',
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo_para_despacho: 'Listo para despacho',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

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
        // Un pedido se edita mientras es de ventas: borrador o pendiente. Después
        // ya está en manos de depósito y cambiarlo desincronizaría lo que se arma
        // de lo que se factura.
        if (!ESTADOS_EDITABLES.includes(data.shipping_status)) {
          toast.error(
            `El pedido está en "${ESTADO_LABEL[data.shipping_status] ?? data.shipping_status}" y no se puede editar. ` +
            'Pedile a depósito que lo devuelva a "Pendiente".',
            { duration: 6000 },
          )
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

  // `tipo_pedido` es el trinquete del backend: una cotización sigue siendo
  // cotización aunque se la cancele sin confirmar, así que es más confiable
  // que mirar el shipping_status actual.
  const modo = pedido?.tipo_pedido === 'cotizacion' ? 'cotizacion' : 'pedido'

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
      clienteId={pedido.cliente_id}
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
      initialModalidadEntrega={pedido.modalidad_entrega}
      initialDireccionEntrega={pedido.direccion_entrega}
      initialDireccionEntregaId={pedido.direccion_entrega_id}
      clienteDomicilio={pedido.cliente_domicilio}
      clienteLocalidad={pedido.cliente_localidad}
      clienteLocalidadId={pedido.cliente_localidad_id}
      clienteCodigoPostal={pedido.cliente_codigo_postal}
      clienteProvincia={pedido.cliente_provincia}
      initialSociedad={pedido.sociedad}
      initialFechaCompromisoPago={pedido.fecha_compromiso_pago}
      initialTipoPrecio={pedido.tipo_precio}
      initialTipoCliente={pedido.tipo_cliente}
      initialAplicaUmbralMayorista={pedido.aplica_umbral_mayorista}
      initialReservaStock={pedido.reserva_stock}
      initialFormaPago={pedido.forma_pago}
      shippingStatus={pedido.shipping_status}
      modo={modo}
      initialItems={initialItems}
      isEditing={true}
      onCancel={handleCancel}
    />
  )
}
