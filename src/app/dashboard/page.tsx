'use client'

import { useState, useEffect, useMemo } from 'react'
import { DollarSign, Package, Users, CreditCard, ClipboardList, FileText, ChevronLeft, ChevronRight, AlertTriangle, UserX, PackageX, Construction, ShoppingCart, HandCoins } from 'lucide-react'
import api from '@/lib/api'
import { DashboardVentas, DashboardAdmin } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { rangoDePeriodo } from '@/lib/periodos'
import PeriodoSelect from '@/components/ui/PeriodoSelect'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import StatCard from '@/components/dashboard/StatCard'
import SalesChart from '@/components/dashboard/SalesChart'
import { SimpleBarChart, SimplePieChart } from '@/components/dashboard/TopProductsChart'
import { MiCalendario } from '@/components/calendar/Calendar'
import { redirect } from 'next/navigation'

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-11 w-11 bg-gray-200 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-[280px] bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  confirmado: 'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
}

const PAGO_ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  acreditado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
}

function VentasDashboard() {
  const [data, setData] = useState<DashboardVentas | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { desde, hasta } = rangoDePeriodo(periodo)
        const res = await api.get<DashboardVentas>('/dashboard/ventas', { params: { desde, hasta } })
        setData(res.data)
      } catch {
        toast.error('Error al cargar el dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [periodo])

  if (loading || !data) return <SkeletonGrid />

  const estadosPedidosData = Object.entries(data.estados_pedidos).map(([name, value]) => ({
    name,
    value,
  }))

  const pctCobrado = data.importe_vendido > 0
    ? Math.round((data.importe_cobrado / data.importe_vendido) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <PeriodoSelect value={periodo} onChange={setPeriodo} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas"
          value={formatCurrency(data.importe_vendido)}
          secondaryLabel={`Cobrado (${pctCobrado}%)`}
          secondaryValue={formatCurrency(data.importe_cobrado)}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Pedidos"
          value={data.total_pedidos}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title="Pedidos Cancelados"
          value={data.pedidos_cancelados}
          icon={PackageX}
          color="red"
        />
        <StatCard
          title="Clientes Activos"
          value={data.clientes_activos}
          icon={Users}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SalesChart
          title="Mis Ventas Ultimos 6 Meses"
          data={data.ventas_mensuales}
          type="line"
        />
        <SimpleBarChart
          title="Mis Top 5 Clientes"
          data={data.top_clientes}
          nameKey="nombre"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SimplePieChart
          title="Estados de Mis Pedidos"
          data={estadosPedidosData}
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4 before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[#00AEEF] before:to-[#003087] before:content-['']">Ultimos Pedidos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">N° Pedido</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Importe</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.ultimos_pedidos.slice(0, 5).map((pedido, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 text-gray-700 font-medium">{pedido.numero_pedido}</td>
                    <td className="px-4 py-2 text-gray-700 font-semibold">{formatCurrency(pedido.importe)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${ESTADO_BADGE[pedido.estado] || 'bg-gray-100 text-gray-700'}`}>
                        {pedido.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{formatDate(pedido.fecha)}</td>
                  </tr>
                ))}
                {data.ultimos_pedidos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin pedidos recientes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function currentMonthValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthOptions(count = 12) {
  const opts: { value: string; label: string }[] = []
  const base = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

function AdminDashboard({ mes, desde, hasta, onLoadingChange }: { mes: string; desde?: string; hasta?: string; onLoadingChange?: (v: boolean) => void }) {
  const [data, setData] = useState<DashboardAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [stockBajoPage, setStockBajoPage] = useState(1)
  const STOCK_BAJO_PAGE_SIZE = 5

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await api.get<DashboardAdmin>('/dashboard/admin', { params: { mes, desde, hasta } })
        setData(res.data)
      } catch {
        toast.error('Error al cargar el dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [mes, desde, hasta])

  // Reporta el estado de carga al header (para el selector de periodo)
  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading, onLoadingChange])

  if (!data) return <SkeletonGrid />

  const tiposPagoData = data.tipos_pago.map((tp) => ({
    name: tp.tipo,
    value: tp.total,
  }))

  return (
    <div className="space-y-6">
      {/* Barra de progreso indeterminada */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-100">
        {loading && <div className="progress-indeterminate" />}
      </div>

      {/* Contenido (atenuado mientras carga) */}
      <div className={`space-y-6 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
      {/* Main Stats - Al ancho completo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas"
          value={formatCurrency(data.importe_vendido)}
          secondaryLabel={`Cobrado (${data.importe_vendido > 0 ? Math.round((data.importe_cobrado / data.importe_vendido) * 100) : 0}%)`}
          secondaryValue={formatCurrency(data.importe_cobrado)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Compras"
          value={formatCurrency(data.importe_comprado)}
          secondaryLabel={`Pagado (${data.importe_comprado > 0 ? Math.round((data.importe_pagado / data.importe_comprado) * 100) : 0}%)`}
          secondaryValue={formatCurrency(data.importe_pagado)}
          icon={ShoppingCart}
          color="purple"
        />
        <StatCard
          title="Pedidos"
          value={data.total_pedidos}
          icon={ClipboardList}
          color="cyan"
        />
        <StatCard
          title="Cobros del Mes"
          value={formatCurrency(data.cobros_mes)}
          icon={CreditCard}
          color="amber"
        />
      </div>

      {/* Main Layout Grid: 1/3 Sidebar (Calendar) y 2/3 Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar: Calendario */}
        <div className="lg:col-span-1">
          <MiCalendario />
        </div>

        {/* Content Area: Alertas, Gráficos y Tablas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gráficos de Ventas e Ingresos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SalesChart
              title="Ingresos Ultimos 6 Meses"
              data={data.ingresos_mensuales}
              type="area"
            />
            <SimpleBarChart
              title="Ventas por Vendedor"
              data={data.ventas_vendedor}
              nameKey="vendedor"
            />
          </div>


        </div>
      </div>

      {/* Secciones de Tablas - Al ancho completo debajo del grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4 before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[#00AEEF] before:to-[#003087] before:content-['']">Top 5 Vendedores del Mes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendedor</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Importe</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {data.top_vendedores.map((v, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2 text-gray-700 font-medium">{v.vendedor}</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-semibold">{formatCurrency(v.total)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{v.pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Productos con Stock Bajo */}
        {(() => {
          const totalStockBajo = data.stock_bajo.length
          const totalPages = Math.max(1, Math.ceil(totalStockBajo / STOCK_BAJO_PAGE_SIZE))
          const safePageNum = Math.min(stockBajoPage, totalPages)
          const startIdx = (safePageNum - 1) * STOCK_BAJO_PAGE_SIZE
          const pageItems = data.stock_bajo.slice(startIdx, startIdx + STOCK_BAJO_PAGE_SIZE)
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[#E31837] before:to-[#A0112A] before:content-['']">Productos con Stock Bajo</h3>
                {totalStockBajo > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{totalStockBajo} productos</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Codigo</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">{p.codigo}</td>
                        <td className="px-3 py-2 text-gray-700">{p.nombre}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            {p.stock}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* Ultimos 5 Pagos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4 before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-[#00AEEF] before:to-[#003087] before:content-['']">Ultimos 5 Pagos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">N° Recibo</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Importe</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.ultimos_pagos.map((pago, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2 text-gray-700 font-medium">{pago.numero_recibo}</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-semibold">{formatCurrency(pago.importe)}</td>
                    <td className="px-3 py-2 text-gray-600 capitalize">{pago.tipo_pago}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDate(pago.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}


export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [periodo, setPeriodo] = useState('mes')
  const [dashLoading, setDashLoading] = useState(false)
  // Interruptor del contenido del dashboard. false = placeholder "en preparación"
  // (no se elimina nada). Poner en true para revivir el panel. Ver docs/OCULTO_PARA_REVIVIR.md
  const DASHBOARD_CONTENT_ENABLED = true

  // Rango del período elegido + mes calendario derivado (para los gráficos históricos).
  const { desde, hasta } = rangoDePeriodo(periodo)
  const mes = /^\d{4}-\d{2}$/.test(periodo) ? periodo : currentMonthValue()

  if (isLoading) return <SkeletonGrid />

  const role = user?.rol

  if (role === 'repartidor') {
    redirect('/dashboard/entregas')
  }
  if (role === 'operaciones') {
    redirect('/dashboard/preparacion')
  }

  const isAdmin = role === 'admin' || role === 'super_admin'

  return (
    <div className="space-y-6">
      {/* Header: título (izquierda) y filtro de periodo (derecha) en la misma fila */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {isAdmin ? 'Panel de Administración' : role === 'ventas' ? 'Mi Panel de Ventas' : 'Panel de Repartidor'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Bienvenido, <span className="font-medium text-gray-700">{user?.nombre_completo || user?.username}</span>
            </p>
          </div>
        </div>

        {DASHBOARD_CONTENT_ENABLED && isAdmin && (
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {dashLoading && (
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#003087]" />
                Actualizando…
              </span>
            )}
            <PeriodoSelect value={periodo} onChange={setPeriodo} />
          </div>
        )}
      </div>

      {DASHBOARD_CONTENT_ENABLED ? (
        <>
          {role === 'ventas' && <VentasDashboard />}
          {isAdmin && <AdminDashboard mes={mes} desde={desde} hasta={hasta} onLoadingChange={setDashLoading} />}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 py-20 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md shadow-black/10"
            style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
          >
            <Construction className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-gray-900">Próximamente</h2>
        </div>
      )}
    </div>
  )
}
