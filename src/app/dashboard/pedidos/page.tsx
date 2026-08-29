'use client'

import PedidosListado from '@/components/pedidos/PedidosListado'

/** Pedidos confirmados en adelante. Las cotizaciones (borradores) viven en
 *  /dashboard/cotizaciones y no se mezclan acá. */
export default function PedidosPage() {
  return <PedidosListado modo="pedidos" />
}
