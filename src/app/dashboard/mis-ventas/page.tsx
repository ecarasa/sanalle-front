'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, Loader2, Users, TrendingUp, Target, DollarSign, Briefcase, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface PedidoComisionDetalle {
  pedido_id: number
  numero_pedido: string
  cliente_nombre: string
  fecha_entrega: string | null
  total_otc: number
  total_generico: number
  total_pedido: number
  comision_calculada: number
}

interface VendedorComisionRow {
  vendedor_id: number
  vendedor_nombre: string
  comision_generico_pct: number
  comision_otc_pct: number
  total_ventas_otc: number
  total_ventas_generico: number
  comision_otc_monto: number
  comision_generico_monto: number
  total_comision: number
  num_pedidos: number
  pedidos: PedidoComisionDetalle[]
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function defaultDesde() {
  const d = new Date()
  d.setDate(1)
  return toInputDate(d)
}

function MetricCard({ title, value, icon: Icon, color, subValue }: { title: string, value: string | number, icon: any, color: string, subValue?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4 transition-all hover:shadow-md hover:-translate-y-1 group">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 transition-colors group-hover:bg-opacity-20`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
      </div>
    </div>
  )
}

export default function MisVentasPage() {
  const { user } = useAuth()
  const [fechaDesde, setFechaDesde] = useState(defaultDesde())
  const [fechaHasta, setFechaHasta] = useState(toInputDate(new Date()))
  const [data, setData] = useState<VendedorComisionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!fechaDesde || !fechaHasta) return
    setLoading(true)
    try {
      const res = await api.get<VendedorComisionRow[]>('/reportes/comisiones-vendedores', {
        params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
      })
      setData(res.data)
      // Auto-expand if it's the seller's view and we have data
      if (res.data.length === 1) {
        setExpandedRow(res.data[0].vendedor_id)
      }
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { fetchData() }, [fetchData])

  const totals = useMemo(() => {
    const totalComision = data.reduce((s, r) => s + r.total_comision, 0)
    const totalVentasG = data.reduce((s, r) => s + r.total_ventas_generico, 0)
    const totalVentasO = data.reduce((s, r) => s + r.total_ventas_otc, 0)
    const totalPedidos = data.reduce((s, r) => s + r.num_pedidos, 0)

    return { totalComision, totalVentasG, totalVentasO, totalPedidos }
  }, [data])

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Header & Main Stats */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#003087] rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Mis Ventas y Comisiones</h1>
          </div>
          <p className="text-gray-500 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Hola {user?.nombre_completo}, aquí puedes ver tu desempeño en el período seleccionado
          </p>
        </div>

        {/* Filter Bar - Glassmorphism */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/40 p-2 flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-gray-700 focus:ring-0 p-0"
            />
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-1 px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-gray-700 focus:ring-0 p-0"
            />
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="ml-2 bg-[#003087] hover:bg-[#002570] text-white p-2 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard 
            title="Mi Comisión" 
            value={formatCurrency(totals.totalComision)} 
            icon={DollarSign} 
            color="bg-emerald-500 text-emerald-500"
            subValue="Monto acumulado a liquidar"
          />
          <MetricCard 
            title="Mis Ventas" 
            value={formatCurrency(totals.totalVentasG + totals.totalVentasO)} 
            icon={Briefcase} 
            color="bg-blue-500 text-blue-500"
            subValue={`${formatCurrency(totals.totalVentasG)} Gen / ${formatCurrency(totals.totalVentasO)} OTC`}
          />
          <MetricCard 
            title="Pedidos Cobrados" 
            value={totals.totalPedidos} 
            icon={Target} 
            color="bg-amber-500 text-amber-500"
            subValue="Finalizados al 100%"
          />
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-[#003087] mb-4" />
            <span className="text-lg font-medium">Cargando tus ventas...</span>
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Users className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">Sin ventas registradas en este período</p>
            <p className="text-sm">Intenta ajustar el rango de fechas</p>
          </div>
        )}

        {!loading && data.map(row => (
          <div key={row.vendedor_id} className="group">
            {/* Summary header */}
            <div
              className={`grid grid-cols-12 gap-4 items-center px-8 py-8 border-b border-gray-50 transition-all cursor-pointer hover:bg-blue-50/30 ${expandedRow === row.vendedor_id ? 'bg-blue-50/50' : ''}`}
              onClick={() => setExpandedRow(expandedRow === row.vendedor_id ? null : row.vendedor_id)}
            >
              <div className="col-span-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedRow === row.vendedor_id ? 'bg-[#003087] text-white rotate-180' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
              <div className="col-span-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Resumen General</p>
                <p className="font-bold text-gray-900 text-xl">Resumen de Comisiones</p>
              </div>
              <div className="col-span-2 text-center">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Pedidos</p>
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-sm font-bold text-gray-700">{row.num_pedidos}</span>
              </div>
              <div className="col-span-2 text-right">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Ventas Gen.</p>
                <span className="text-sm text-gray-600 font-bold">{formatCurrency(row.total_ventas_generico)}</span>
                <p className="text-[10px] text-blue-600 font-bold mt-0.5">{row.comision_generico_pct}% Com.</p>
              </div>
              <div className="col-span-2 text-right">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Ventas OTC</p>
                <span className="text-sm text-gray-600 font-bold">{formatCurrency(row.total_ventas_otc)}</span>
                <p className="text-[10px] text-purple-600 font-bold mt-0.5">{row.comision_otc_pct}% Com.</p>
              </div>
              <div className="col-span-2 text-right relative">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Total Comisión</p>
                <span className="text-2xl font-black text-[#003087]">{formatCurrency(row.total_comision)}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedRow === row.vendedor_id && (
              <div className="bg-gray-50/50 px-12 py-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Desglose de mis pedidos</p>
                  <span className="text-[10px] text-gray-400 italic">Lista detallada de operaciones cobradas</span>
                </div>
                <div className="rounded-3xl shadow-sm border border-gray-100 overflow-hidden bg-white">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 bg-gray-50/30">
                    <div className="col-span-2">Referencia</div>
                    <div className="col-span-3">Cliente</div>
                    <div className="col-span-2 text-center">Entrega</div>
                    <div className="col-span-2 text-right">Ventas Gen.</div>
                    <div className="col-span-1 text-right">OTC</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-right text-[#003087]">Comisión</div>
                  </div>
                  {row.pedidos.map(p => (
                    <div key={p.pedido_id} className="grid grid-cols-12 gap-4 items-center px-6 py-4 border-b border-gray-50 last:border-0 text-sm transition-colors hover:bg-gray-50/50">
                      <div className="col-span-2 font-bold text-gray-900">{p.numero_pedido}</div>
                      <div className="col-span-3 text-gray-600 font-medium truncate">{p.cliente_nombre}</div>
                      <div className="col-span-2 text-center text-gray-500 text-xs font-medium">
                        {p.fecha_entrega ?? '—'}
                      </div>
                      <div className="col-span-2 text-right text-gray-600 font-medium">{formatCurrency(p.total_generico)}</div>
                      <div className="col-span-1 text-right text-gray-600 font-medium">{formatCurrency(p.total_otc)}</div>
                      <div className="col-span-1 text-right font-bold text-gray-800">{formatCurrency(p.total_pedido)}</div>
                      <div className="col-span-1 text-right font-black text-[#003087]">{formatCurrency(p.comision_calculada)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
