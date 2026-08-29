'use client'

import PedidosListado from '@/components/pedidos/PedidosListado'

/** Pedidos todavía en armado y presupuestos sin confirmar: el mismo listado que
 *  Pedidos, acotado a los que están en borrador. Se separan porque mezclarlos
 *  con los pedidos cerrados hacía que no se supiera cuáles estaban en firme. */
export default function CotizacionesPage() {
  return <PedidosListado modo="cotizaciones" />
}
