'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Banknote, Loader2, Search, Plus, Link2 } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { rangoDePeriodo } from '@/lib/periodos'
import PeriodoSelect from '@/components/ui/PeriodoSelect'
import RegistrarPagoProveedorModal from '@/components/proveedores/RegistrarPagoProveedorModal'

interface PagoProveedorRow {
  id: number
  proveedor_id: number
  proveedor_nombre: string | null
  pago_id: number | null
  importe: number
  fecha_pago: string
  tipo_pago: string
  tipo_cuenta: string
  referencia_pago: string | null
  observacion: string | null
}

const CUENTA_BADGE: Record<string, string> = {
  remito: 'bg-indigo-100 text-indigo-700',
  factura: 'bg-purple-100 text-purple-700',
}

export default function PagosProveedorPage() {
  const [data, setData] = useState<PagoProveedorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [periodo, setPeriodo] = useState('mes')
  const [modalOpen, setModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PagoProveedorRow[]>('/pagos-proveedor')
      setData(res.data)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const { desde, hasta } = rangoDePeriodo(periodo)
    return data.filter((p) => {
      if (q && !(
        (p.proveedor_nombre || '').toLowerCase().includes(q) ||
        (p.referencia_pago || '').toLowerCase().includes(q)
      )) return false
      // fecha_pago es ISO ('YYYY-MM-DD...'); comparar por día como string funciona.
      const dia = (p.fecha_pago || '').slice(0, 10)
      if (desde && dia < desde) return false
      if (hasta && dia > hasta) return false
      return true
    })
  }, [data, search, periodo])

  const total = useMemo(() => filtered.reduce((s, p) => s + p.importe, 0), [filtered])

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#E31837] rounded-lg">
          <Banknote className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos a proveedor</h1>
          <p className="text-sm text-gray-500">Transferencias y pagos que salen hacia proveedores.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Registrar pago
        </button>
      </div>

      {/* Total del conjunto filtrado */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Total egresado ({filtered.length})</span>
        <span className="text-xl font-bold text-[#E31837]">{formatCurrency(total)}</span>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proveedor o referencia..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período</span>
          <PeriodoSelect value={periodo} onChange={setPeriodo} />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-8 h-8 animate-spin text-[#003087]" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">No hay pagos a proveedor registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-left">Cuenta</th>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-left">Referencia</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(p.fecha_pago)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-1.5">
                        {p.proveedor_nombre || '-'}
                        {p.pago_id && (
                          <span title="Financiado por un cobro de cliente" className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#0086c3] bg-[#00AEEF]/10 px-1.5 py-0.5 rounded">
                            <Link2 className="w-3 h-3" /> cobro
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${CUENTA_BADGE[p.tipo_cuenta] || 'bg-gray-100 text-gray-600'}`}>
                        {p.tipo_cuenta}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.tipo_pago}</td>
                    <td className="px-4 py-3 text-gray-600">{p.referencia_pago || <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#E31837] whitespace-nowrap">
                      -{formatCurrency(p.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RegistrarPagoProveedorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  )
}
