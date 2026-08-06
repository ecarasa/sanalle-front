'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, Filter, Search, Loader2, FileText, Tag, CreditCard, ChevronDown, ChevronUp, Banknote, Receipt, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import DataGrid from '@/components/grilla/DataGrid'
import { CuentaSanalle, CuentaSanalleListResponse, TipoMovimientoSanalle, CategoriaMovimientoSanalle } from '@/types'
import CuentaSanalleModal from '@/components/admin/CuentaSanalleModal'

function StatCard({ title, amount, icon: Icon, color }: { title: string; amount: number; icon: any; color: 'green' | 'red' | 'blue' }) {
  const colorMap = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  }

  return (
    <div className={`flex flex-col p-4 rounded-2xl border ${colorMap[color]} shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{title}</span>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
      <span className="text-2xl font-black">{formatCurrency(amount)}</span>
    </div>
  )
}

export default function AdminCuentaSanallePage() {
  useAuth()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<CuentaSanalle[]>([])
  const [resumen, setResumen] = useState<{
    ingresos: number
    egresos: number
    balance: number
    por_metodo: Record<string, { ingresos: number; egresos: number; balance: number }>
  }>({ ingresos: 0, egresos: 0, balance: 0, por_metodo: {} })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [tipoFilter, setTipoFilter] = useState<string>('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)

  const fetchMovimientos = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        page_size: pageSize,
      }
      if (tipoFilter) params.tipo = tipoFilter
      if (categoriaFilter) params.categoria = categoriaFilter

      const res = await api.get<CuentaSanalleListResponse>('/cuenta-sanalle', { params })
      setData(res.data.items)
      setTotal(res.data.total)
      setResumen(res.data.resumen)
    } catch {
      toast.error('Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, tipoFilter, categoriaFilter])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  const columns = useMemo(() => [
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-600">{new Date(value).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: TipoMovimientoSanalle) => (
        <div className="flex items-center gap-1.5">
          {value === 'ingreso' ? (
            <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
          ) : (
            <ArrowDownCircle className="w-4 h-4 text-rose-500" />
          )}
          <span className={`text-[10px] font-black uppercase ${value === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {value}
          </span>
        </div>
      ),
    },
    {
      key: 'categoria',
      label: 'Categoría',
      render: (value: CategoriaMovimientoSanalle) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 uppercase border border-gray-200">
          {value.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'importe',
      label: 'Importe',
      sortable: true,
      render: (value: number, row: CuentaSanalle) => (
        <span className={`text-sm font-bold ${row.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {row.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'metodo_pago',
      label: 'Método',
      render: (value: string) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <CreditCard className="w-3.5 h-3.5 text-gray-400" />
          <span className="capitalize">{value.toLowerCase()}</span>
        </div>
      ),
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      render: (value: string) => (
        <span className="text-xs text-gray-500 italic max-w-[200px] truncate block" title={value}>
          {value || '-'}
        </span>
      ),
    },
  ], [])

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cuenta Sanalle</h1>
          <p className="text-sm text-gray-500">Libro mayor y flujo de caja administrativo</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] transition-all shadow-lg shadow-[#003087]/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Registrar Movimiento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Ingresos" amount={resumen.ingresos} icon={ArrowUpCircle} color="green" />
        <StatCard title="Total Egresos" amount={resumen.egresos} icon={ArrowDownCircle} color="red" />
        <StatCard title="Balance Neto" amount={resumen.balance} icon={Wallet} color="blue" />
      </div>

      {Object.keys(resumen.por_metodo).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Desglose por Método de Pago</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(resumen.por_metodo).map(([metodo, totales]) => {
              const config: Record<string, { label: string; icon: any; bg: string; text: string; border: string; iconColor: string }> = {
                efectivo: { label: 'Efectivo', icon: Banknote, bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', iconColor: 'text-emerald-500' },
                transferencia: { label: 'Transferencia', icon: Building2, bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', iconColor: 'text-sky-500' },
                cheque: { label: 'Cheque', icon: Receipt, bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', iconColor: 'text-amber-500' },
                retencion: { label: 'Retención', icon: FileText, bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200', iconColor: 'text-violet-500' },
              }
              const c = config[metodo] || { label: metodo, icon: CreditCard, bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200', iconColor: 'text-gray-500' }
              const Icon = c.icon
              return (
                <div key={metodo} className={`rounded-2xl border ${c.border} ${c.bg} p-4 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-5 h-5 ${c.iconColor}`} />
                    <span className={`text-sm font-bold ${c.text}`}>{c.label}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500 font-medium">Ingresos</span>
                      <span className="text-sm font-bold text-emerald-600">+{formatCurrency(totales.ingresos)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500 font-medium">Egresos</span>
                      <span className="text-sm font-bold text-rose-600">-{formatCurrency(totales.egresos)}</span>
                    </div>
                    <div className="h-px bg-gray-200/80 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500 font-bold">Balance</span>
                      <span className={`text-sm font-black ${totales.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(totales.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 uppercase">Filtros</span>
        </div>

        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="text-xs font-bold bg-gray-50 border-gray-200 rounded-lg focus:ring-[#003087] focus:border-[#003087]"
        >
          <option value="">Todos los Tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>

        <select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          className="text-xs font-bold bg-gray-50 border-gray-200 rounded-lg focus:ring-[#003087] focus:border-[#003087]"
        >
          <option value="">Todas las Categorías</option>
          <option value="cobro_cliente">Cobro Cliente</option>
          <option value="pago_proveedor">Pago Proveedor</option>
          <option value="gasto_general">Gasto General</option>
          <option value="sueldo">Sueldo</option>
          <option value="impuesto">Impuesto</option>
          <option value="ajuste">Ajuste</option>
          <option value="ingreso_extraordinario">Ingreso Extraordinario</option>
          <option value="transferencia_recibida">Transferencia Recibida</option>
          <option value="cheque_recibido">Cheque Recibido</option>
          <option value="compra_mercaderia">Compra Mercadería</option>
          <option value="otro">Otro</option>
        </select>

        {(tipoFilter || categoriaFilter) && (
          <button
            onClick={() => { setTipoFilter(''); setCategoriaFilter('') }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 underline underline-offset-4"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      <DataGrid
        columns={columns}
        data={data}
        isLoading={loading}
        totalRows={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <CuentaSanalleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); fetchMovimientos() }}
      />
    </div>
  )
}
