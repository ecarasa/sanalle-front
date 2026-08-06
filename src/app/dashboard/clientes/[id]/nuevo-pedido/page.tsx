'use client'

import { useParams } from 'next/navigation'
import NuevoPedidoWrapper from '@/components/pedidos/NuevoPedidoWrapper'

export default function NuevoPedidoPage() {
  const params = useParams()
  const clienteId = Number(params.id)

  return <NuevoPedidoWrapper initialClienteId={clienteId} />
}
