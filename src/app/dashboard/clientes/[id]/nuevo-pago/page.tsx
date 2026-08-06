'use client'

import { useParams } from 'next/navigation'
import PagoForm from '@/components/pagos/PagoForm'

export default function NuevoPagoPage() {
  const params = useParams()
  const clienteId = Number(params.id)

  return <PagoForm initialClienteId={clienteId} />
}
