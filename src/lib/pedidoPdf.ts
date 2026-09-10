import api from '@/lib/api'
import toast from 'react-hot-toast'

/**
 * Abre el remito de un pedido en una pestaña nueva.
 *
 * `sinValores` pide la copia sin importes ni descuentos: es la que se le da a
 * depósito para armar, porque el personal de armado no tiene por qué ver los
 * precios de venta. El backend lo resuelve en `GET /pedidos/{id}/pdf`.
 *
 * Vive acá y no en cada pantalla para que Entregas y Preparación no puedan
 * divergir en cómo abren el mismo documento.
 */
export async function abrirPedidoPdf(
  pedidoId: number,
  { sinValores = false }: { sinValores?: boolean } = {}
): Promise<void> {
  try {
    const res = await api.get(`/pedidos/${pedidoId}/pdf`, {
      responseType: 'blob',
      params: sinValores ? { sin_valores: true } : undefined,
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // El navegador ya tiene el blob cargado; liberar la URL después evita que la
    // pestaña quede reteniendo el PDF en memoria toda la sesión.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    toast.error('Error al abrir el PDF')
  }
}
