'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronUp, Loader2, Users, TrendingUp, Target, DollarSign, Briefcase, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface PedidoItemComisionDetalle {
  producto_id: number
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  precio_total: number
  categoria: string
  comision_calculada: number
  descuento_porcentaje: number
  comision_porcentaje: number
}

interface PedidoComisionDetalle {
  pedido_id: number
  numero_pedido: string
  cliente_nombre: string
  fecha_entrega: string | null
  total_otc: number
  total_generico: number
  total_pedido: number
  comision_calculada: number
  items: PedidoItemComisionDetalle[]
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

export default function ComisionesVendedoresPage() {
  const [fechaDesde, setFechaDesde] = useState(defaultDesde())
  const [fechaHasta, setFechaHasta] = useState(toInputDate(new Date()))
  const [data, setData] = useState<VendedorComisionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [expandedPedido, setExpandedPedido] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!fechaDesde || !fechaHasta) return
    setLoading(true)
    try {
      const res = await api.get<VendedorComisionRow[]>('/reportes/comisiones-vendedores', {
        params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
      })
      setData(res.data)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { fetchData() }, [fetchData])

  const handleComisionChange = useCallback((vendedorId: number, pedidoId: number, productoNombre: string, newPctStr: string) => {
    const isEditing = newPctStr === '';
    const newPct = parseFloat(newPctStr) || 0;

    setData(prevData => prevData.map(v => {
      if (v.vendedor_id !== vendedorId) return v;

      // Deep copy to avoid mutating state directly
      const newVendedor = { ...v, pedidos: v.pedidos.map(p => ({ ...p, items: p.items.map(i => ({ ...i })) })) };

      let newComisionOtcMonto = 0;
      let newComisionGenMonto = 0;

      newVendedor.pedidos = newVendedor.pedidos.map(p => {
        let pedidoComisionCalculada = 0;

        p.items = p.items.map(item => {
          if (p.pedido_id === pedidoId && item.producto_nombre === productoNombre) {
            // Store the string if empty so the user can delete the number, otherwise store the parsed number
            (item as any).comision_porcentaje = isEditing ? '' : newPct;
            item.comision_calculada = (item.precio_total * newPct) / 100;
          }

          pedidoComisionCalculada += item.comision_calculada;

          if (item.categoria === 'OTC') {
            newComisionOtcMonto += item.comision_calculada;
          } else {
            newComisionGenMonto += item.comision_calculada;
          }

          return item;
        });

        p.comision_calculada = pedidoComisionCalculada;
        return p;
      });

      newVendedor.comision_otc_monto = newComisionOtcMonto;
      newVendedor.comision_generico_monto = newComisionGenMonto;
      newVendedor.total_comision = newComisionOtcMonto + newComisionGenMonto;

      return newVendedor;
    }));
  }, []);

  const handleComisionBlur = useCallback(async (pedidoId: number, productoId: number, newPctStr: string) => {
    const newPct = parseFloat(newPctStr);
    if (isNaN(newPct)) return;
    try {
      await api.patch(`/pedidos/${pedidoId}/items/${productoId}/comision`, {
        comision_porcentaje: newPct
      });
    } catch (error) {
      console.error("Failed to update commission:", error);
    }
  }, []);

  const totals = useMemo(() => {
    const totalComision = data.reduce((s, r) => s + r.total_comision, 0)
    const totalVentasG = data.reduce((s, r) => s + r.total_ventas_generico, 0)
    const totalVentasO = data.reduce((s, r) => s + r.total_ventas_otc, 0)
    const totalPedidos = data.reduce((s, r) => s + r.num_pedidos, 0)
    const bestSeller = data.length > 0 ? [...data].sort((a, b) => b.total_comision - a.total_comision)[0] : null

    return { totalComision, totalVentasG, totalVentasO, totalPedidos, bestSeller }
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
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Comisiones Vendedores</h1>
          </div>
          <p className="text-gray-500 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Pedidos cobrados al 100% en el período seleccionado
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Comisiones"
            value={formatCurrency(totals.totalComision)}
            icon={DollarSign}
            color="bg-emerald-500 text-emerald-500"
            subValue="Monto acumulado a liquidar"
          />
          <MetricCard
            title="Ventas Totales"
            value={formatCurrency(totals.totalVentasG + totals.totalVentasO)}
            icon={Briefcase}
            color="bg-blue-500 text-blue-500"
            subValue={`${formatCurrency(totals.totalVentasG)} Gen / ${formatCurrency(totals.totalVentasO)} OTC`}
          />
          <MetricCard
            title="Pedidos Totales"
            value={totals.totalPedidos}
            icon={Users}
            color="bg-amber-500 text-amber-500"
            subValue="Finalizados y cobrados"
          />
          <MetricCard
            title="Mejor Vendedor"
            value={totals.bestSeller?.vendedor_nombre || 'N/A'}
            icon={Target}
            color="bg-purple-500 text-purple-500"
            subValue={`${formatCurrency(totals.bestSeller?.total_comision || 0)} en comisión`}
          />
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50 bg-gray-50/50">
          <div className="col-span-1" />
          <div className="col-span-3">Vendedor</div>
          <div className="col-span-1 text-center">Pedidos</div>
          <div className="col-span-2 text-right">Ventas Genérico</div>
          <div className="col-span-1 text-right">Com. Gen.</div>
          <div className="col-span-2 text-right">Ventas OTC</div>
          <div className="col-span-1 text-right">Com. OTC</div>
          <div className="col-span-1 text-right">Total Com.</div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-[#003087] mb-4" />
            <span className="text-lg font-medium">Procesando reportes...</span>
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Users className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">Sin datos para el período seleccionado</p>
            <p className="text-sm">Intenta ajustar el rango de fechas</p>
          </div>
        )}

        {!loading && data.map(row => (
          <div key={row.vendedor_id} className="group">
            {/* Summary row */}
            <div
              className={`grid grid-cols-12 gap-4 items-center px-8 py-6 border-b border-gray-50 transition-all cursor-pointer hover:bg-blue-50/30 ${expandedRow === row.vendedor_id ? 'bg-blue-50/50' : ''}`}
              onClick={() => setExpandedRow(expandedRow === row.vendedor_id ? null : row.vendedor_id)}
            >
              <div className="col-span-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedRow === row.vendedor_id ? 'bg-[#003087] text-white rotate-180' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
              <div className="col-span-3">
                <p className="font-bold text-gray-900 text-base">{row.vendedor_nombre}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-tight">Gen {row.comision_generico_pct}%</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-tight">OTC {row.comision_otc_pct}%</span>
                </div>
              </div>
              <div className="col-span-1 text-center">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-sm font-bold text-gray-700">{row.num_pedidos}</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-sm text-gray-600 font-medium">{formatCurrency(row.total_ventas_generico)}</span>
              </div>
              <div className="col-span-1 text-right">
                <span className="text-sm font-bold text-blue-600">{formatCurrency(row.comision_generico_monto)}</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-sm text-gray-600 font-medium">{formatCurrency(row.total_ventas_otc)}</span>
              </div>
              <div className="col-span-1 text-right">
                <span className="text-sm font-bold text-purple-600">{formatCurrency(row.comision_otc_monto)}</span>
              </div>
              <div className="col-span-1 text-right relative">
                <span className="text-lg font-black text-[#003087]">{formatCurrency(row.total_comision)}</span>
                <div className="absolute -bottom-2 right-0 w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#003087] rounded-full"
                    style={{ width: `${(row.total_comision / (totals.totalComision || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedRow === row.vendedor_id && (
              <div className="bg-gray-50/50 px-12 py-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Desglose de Pedidos</p>
                  <span className="text-[10px] text-gray-400 italic">Mostrando {row.pedidos.length} operaciones</span>
                </div>
                <div className="rounded-3xl shadow-sm border border-gray-100 overflow-hidden bg-white">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 bg-gray-50/30">
                    <div className="col-span-2">Referencia</div>
                    <div className="col-span-3">Cliente</div>
                    <div className="col-span-2 text-center">Entrega</div>
                    <div className="col-span-2 text-right">Genérico</div>
                    <div className="col-span-1 text-right">OTC</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-right text-[#003087]">Comisión</div>
                  </div>
                  {row.pedidos.map(p => (
                    <div key={p.pedido_id} className="border-b border-gray-50 last:border-0">
                      <div
                        className={`grid grid-cols-12 gap-4 items-center px-6 py-4 text-sm transition-colors cursor-pointer hover:bg-gray-50/80 ${expandedPedido === p.pedido_id ? 'bg-blue-50/30' : ''}`}
                        onClick={() => setExpandedPedido(expandedPedido === p.pedido_id ? null : p.pedido_id)}
                      >
                        <div className="col-span-2 font-bold text-gray-900 flex items-center gap-2">
                          <div className={`transition-transform ${expandedPedido === p.pedido_id ? 'rotate-180' : ''}`}>
                            <ChevronDown size={14} className="text-gray-400" />
                          </div>
                          {p.numero_pedido}
                        </div>
                        <div className="col-span-3 text-gray-600 font-medium truncate">{p.cliente_nombre}</div>
                        <div className="col-span-2 text-center text-gray-500 text-xs font-medium">
                          {p.fecha_entrega ?? '—'}
                        </div>
                        <div className="col-span-2 text-right text-gray-600 font-medium">{formatCurrency(p.total_generico)}</div>
                        <div className="col-span-1 text-right text-gray-600 font-medium">{formatCurrency(p.total_otc)}</div>
                        <div className="col-span-1 text-right font-bold text-gray-800">{formatCurrency(p.total_pedido)}</div>
                        <div className="col-span-1 text-right font-black text-[#003087]">{formatCurrency(p.comision_calculada)}</div>
                      </div>

                      {expandedPedido === p.pedido_id && (
                        <div className="px-10 py-4 bg-gray-50/80 border-t border-gray-100">
                          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200">
                            <div className="col-span-4">Producto</div>
                            <div className="col-span-1 text-center">Cant.</div>
                            <div className="col-span-1 text-right">Unit.</div>
                            <div className="col-span-1 text-center">Cat.</div>
                            <div className="col-span-1 text-center">Desc %.</div>
                            <div className="col-span-1 text-center text-[#003087]">Com %</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                            <div className="col-span-1 text-right text-[#003087]">Comisión</div>
                          </div>
                          {p.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-4 px-4 py-2 text-xs items-center border-b border-gray-100 last:border-0 hover:bg-white/50 transition-colors">
                              <div className="col-span-4 font-medium text-gray-700 truncate">{item.producto_nombre}</div>
                              <div className="col-span-1 text-center font-bold text-gray-600">{item.cantidad}</div>
                              <div className="col-span-1 text-right text-gray-500">{formatCurrency(item.precio_unitario)}</div>
                              <div className="col-span-1 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${item.categoria === 'OTC' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {item.categoria}
                                </span>
                              </div>
                              <div className="col-span-1 text-center text-gray-500 text-[10px] font-medium">
                                {item.descuento_porcentaje}%
                              </div>
                              <div className="col-span-1 flex items-center justify-center">
                                <input
                                  type="number"
                                  className="w-12 text-center text-[#003087] font-bold text-[10px] bg-transparent border-b border-transparent hover:border-[#003087]/30 focus:border-[#003087] focus:outline-none transition-colors"
                                  value={item.comision_porcentaje}
                                  onChange={(e) => handleComisionChange(row.vendedor_id, p.pedido_id, item.producto_nombre, e.target.value)}
                                  onBlur={(e) => handleComisionBlur(p.pedido_id, item.producto_id, e.target.value)}
                                  step="0.01"
                                  min="0"
                                />
                                <span className="text-[#003087] font-bold text-[10px] ml-0.5">%</span>
                              </div>
                              <div className="col-span-2 text-right font-semibold text-gray-700">{formatCurrency(item.precio_total)}</div>
                              <div className="col-span-1 text-right font-black text-[#003087]">{formatCurrency(item.comision_calculada)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Totals Footer */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-12 gap-4 items-center px-8 py-8 bg-[#003087] border-t-2 border-[#003087]/20 text-white">
            <div className="col-span-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Cierre del período</p>
              <p className="text-xl font-black">{data.length} Vendedores Activos</p>
            </div>
            <div className="col-span-2 text-right">
              <p className="text-[10px] text-white/50 mb-1">Total Genérico</p>
              <p className="text-sm font-bold">{formatCurrency(totals.totalVentasG)}</p>
            </div>
            <div className="col-span-1 text-right">
              <p className="text-[10px] text-white/50 mb-1">Com. Gen</p>
              <p className="text-sm font-bold text-blue-200">{formatCurrency(data.reduce((s, r) => s + r.comision_generico_monto, 0))}</p>
            </div>
            <div className="col-span-2 text-right">
              <p className="text-[10px] text-white/50 mb-1">Total OTC</p>
              <p className="text-sm font-bold">{formatCurrency(totals.totalVentasO)}</p>
            </div>
            <div className="col-span-1 text-right">
              <p className="text-[10px] text-white/50 mb-1">Com. OTC</p>
              <p className="text-sm font-bold text-purple-200">{formatCurrency(data.reduce((s, r) => s + r.comision_otc_monto, 0))}</p>
            </div>
            <div className="col-span-1 text-right">
              <p className="text-[10px] text-white/50 mb-1">Liquidación Final</p>
              <p className="text-3xl font-black text-white">{formatCurrency(totals.totalComision)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
