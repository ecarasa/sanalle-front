'use client'

import { useState, useEffect, useMemo } from 'react'
import { DollarSign, Package, Users, CreditCard, ClipboardList, FileText, ChevronLeft, ChevronRight, AlertTriangle, UserX, PackageX } from 'lucide-react'
import api from '@/lib/api'
import { DashboardVentas, DashboardAdmin } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
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
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<DashboardVentas>('/dashboard/ventas')
        setData(res.data)
      } catch {
        toast.error('Error al cargar el dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading || !data) return <SkeletonGrid />

  const estadosPedidosData = Object.entries(data.estados_pedidos).map(([name, value]) => ({
    name,
    value,
  }))



  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Importe Total Vendido"
          value={formatCurrency(data.total_vendido)}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Pedidos del Mes"
          value={data.pedidos_mes}
          icon={Package}
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
        <StatCard
          title="Cobros del Mes"
          value={formatCurrency(data.cobros_mes)}
          icon={CreditCard}
          color="cyan"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ultimos Pedidos</h3>
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

function AdminDashboard() {
  const [data, setData] = useState<DashboardAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [stockBajoPage, setStockBajoPage] = useState(1)
  const [mes, setMes] = useState<string>(currentMonthValue())
  const STOCK_BAJO_PAGE_SIZE = 5
  const monthOptions = useMemo(() => buildMonthOptions(12), [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await api.get<DashboardAdmin>('/dashboard/admin', { params: { mes } })
        setData(res.data)
      } catch {
        toast.error('Error al cargar el dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [mes])

  if (!data) return <SkeletonGrid />

  const tiposPagoData = data.tipos_pago.map((tp) => ({
    name: tp.tipo,
    value: tp.total,
  }))

  return (
    <div className="space-y-6">
      {/* Selector de mes */}
      <div className="flex items-center justify-end gap-3">
        {loading && (
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#003087]" />
            Actualizando…
          </span>
        )}
        <label htmlFor="dashboard-mes" className="text-sm font-medium text-gray-600">
          Periodo
        </label>
        <select
          id="dashboard-mes"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-[#003087] focus:outline-none focus:ring-1 focus:ring-[#003087] disabled:opacity-60"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Barra de progreso indeterminada */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-100">
        {loading && <div className="progress-indeterminate" />}
      </div>

      {/* Contenido (atenuado mientras carga) */}
      <div className={`space-y-6 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
      {/* Main Stats - Al ancho completo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas Totales Mes"
          value={formatCurrency(data.ventas_totales)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Pedidos del Mes"
          value={data.pedidos_totales}
          icon={ClipboardList}
          color="cyan"
        />
        <StatCard
          title="Pedidos Cancelados"
          value={data.pedidos_cancelados}
          icon={PackageX}
          color="red"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 Vendedores del Mes</h3>
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Productos con Stock Bajo</h3>
                {totalStockBajo > 0 && (
                  <span className="text-xs text-gray-400">{totalStockBajo} productos</span>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ultimos 5 Pagos</h3>
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

  if (isLoading) return <SkeletonGrid />

  const role = user?.rol

  if (role === 'repartidor') {
    redirect('/dashboard/entregas')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {(role === 'admin' || role === 'super_admin') ? 'Panel de Administración' : role === 'ventas' ? 'Mi Panel de Ventas' : 'Panel de Repartidor'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Bienvenido, {user?.nombre_completo || user?.username}
        </p>
      </div>

      {role === 'ventas' && <VentasDashboard />}
      {(role === 'admin' || role === 'super_admin') && <AdminDashboard />}
    </div>
  )
}
