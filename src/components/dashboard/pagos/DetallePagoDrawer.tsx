'use client'

import { X } from 'lucide-react'
import { Pago } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  pago: Pago | null
  isOpen: boolean
  onClose: () => void
}

export default function DetallePagoDrawer({ pago, isOpen, onClose }: Props) {
  if (!isOpen || !pago) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white h-full w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detalle del Pago</h2>
            <p className="text-sm text-gray-500 mt-0.5">Recibo {pago.numero_recibo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Importe Cobrado</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(pago.importe)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Saldo p/ Imputar</p>
              <p className={`text-base font-bold ${pago.saldo_restante > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                {formatCurrency(pago.saldo_restante)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Cliente</p>
              <p className="text-sm font-medium text-gray-900">{pago.cliente_nombre || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Fecha</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(pago.fecha_recepcion)}</p>
            </div>
          </div>

          {/* Explanation note */}
          <p className="text-xs text-gray-400 italic">
            Los pedidos imputados y los pagos a proveedores son independientes: el mismo cobro puede cancelar pedidos del cliente y, a la vez, el efectivo se usa para pagar deuda propia desde Cuenta Sanalle.
          </p>

          {/* Imputaciones */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Pedidos Imputados ({pago.imputaciones.length})
            </h3>
            {pago.imputaciones.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin imputaciones a pedidos.</p>
            ) : (
              <div className="space-y-2">
                {pago.imputaciones.map((imp) => (
                  <div
                    key={imp.id}
                    className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Pedido #{imp.numero_pedido || imp.pedido_id}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(imp.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">
                      {formatCurrency(imp.monto)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                  <span className="text-gray-600">Total imputado a pedidos:</span>
                  <span className="text-emerald-700">
                    {formatCurrency(pago.imputaciones.reduce((s, i) => s + i.monto, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Pagos a Proveedores */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Pagos a Proveedores ({pago.pagos_proveedor.length})
            </h3>
            {pago.pagos_proveedor.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin pagos a proveedores vinculados.</p>
            ) : (
              <div className="space-y-2">
                {pago.pagos_proveedor.map((pp) => (
                  <div
                    key={pp.id}
                    className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {pp.proveedor_nombre || `Proveedor #${pp.proveedor_id}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {pp.tipo_pago} · {pp.tipo_cuenta}
                        {pp.referencia_pago ? ` · Ref: ${pp.referencia_pago}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(pp.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-700">
                      {formatCurrency(pp.importe)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                  <span className="text-gray-600">Total pagado a proveedores:</span>
                  <span className="text-blue-700">
                    {formatCurrency(pago.pagos_proveedor.reduce((s, pp) => s + pp.importe, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Observations */}
          {pago.observacion && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Observación</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{pago.observacion}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
