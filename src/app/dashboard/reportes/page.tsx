'use client'

import Link from 'next/link'
import { CreditCard, DollarSignIcon, Package, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'


export default function ReportesPage() {
  const { user } = useAuth()

  console.log(user)



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reportes y an&aacute;lisis exportables
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/reportes/pagos-por-pedido"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-[#003087]/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#003087]/10 text-[#003087] group-hover:bg-[#003087] group-hover:text-white transition-colors">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Pagos por Pedido</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Detalle de pagos asociados a cada pedido con saldo pendiente
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/reportes/comisiones-vendedores"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-green-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-600 group-hover:bg-yellow-500 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Comisiones Vendedores</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Comisiones por per&iacute;odo seg&uacute;n pedidos cobrados al 100%
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/reportes/stock"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-[#00AEEF]/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] group-hover:bg-[#00AEEF] group-hover:text-white transition-colors">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Historial de Stock</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Auditoría de transferencias, fraccionamientos y ajustes manuales
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/reportes/historial-pvp"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-green-500/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10 text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
              <DollarSignIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Historial de PVP</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Auditoría de cambios en el Precio de Venta al Público
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
