'use client'

import { useSearchParams } from 'next/navigation'
import NuevoPedidoWrapper from '@/components/pedidos/NuevoPedidoWrapper'

export default function NuevoPedidoGeneralPage() {
  // `?modo=cotizacion` es lo que manda el botón "Nueva Cotización" del listado
  // de Cotizaciones. Cualquier otro valor (o ausencia) es un pedido común.
  const modo = useSearchParams().get('modo') === 'cotizacion' ? 'cotizacion' : 'pedido'
  return <NuevoPedidoWrapper modo={modo} />
}
