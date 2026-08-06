'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Calendar, Wallet, FileText, Filter, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { CuentaCorrienteResponse, CuentaCorrienteMovimiento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function CuentaCorrientePage() {
  useAuth()
  const router = useRouter()
  const params = useParams()
  const clienteId = Number(params.id)

  const [data, setData] = useState<CuentaCorrienteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchCuentaCorriente = useCallback(async () => {
    setLoading(true)
    try {
      const queryParams: Record<string, string> = {}
      if (fechaDesde) queryParams.fecha_desde = fechaDesde
      if (fechaHasta) queryParams.fecha_hasta = fechaHasta
      if (tipoCuenta) queryParams.tipo_cuenta = tipoCuenta

      const res = await api.get<CuentaCorrienteResponse>(
        `/cuenta-corriente/${clienteId}/movimientos`,
        { params: queryParams }
      )
      setData(res.data)
    } catch {
      toast.error('Error al cargar cuenta corriente')
    } finally {
      setLoading(false)
    }
  }, [clienteId, fechaDesde, fechaHasta, tipoCuenta])

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const queryParams = new URLSearchParams()
      if (fechaDesde) queryParams.append('fecha_desde', fechaDesde)
      if (fechaHasta) queryParams.append('fecha_hasta', fechaHasta)
      if (tipoCuenta) queryParams.append('tipo_cuenta', tipoCuenta)

      const response = await api.get(`/cuenta-corriente/${clienteId}/exportar-pdf?${queryParams.toString()}`, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `ESTADO_CUENTA_${clienteId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      toast.success('Estado de cuenta generado con éxito')
    } catch {
      toast.error('Error al generar el PDF del estado de cuenta')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    fetchCuentaCorriente()
  }, [fetchCuentaCorriente])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#003087]/10">
            <Wallet className="w-6 h-6 text-[#003087]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cuenta Corriente</h1>
            <p className="text-sm text-gray-500 mt-1">
              {data?.cliente_nombre || `Cliente #${clienteId}`}
            </p>
          </div>
        </div>
      </div>

      {/* Saldos */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
            data.saldo_total > 0 ? 'bg-red-50 text-red-700' : data.saldo_total < 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
          }`}>
            Saldo: {formatCurrency(Math.abs(data.saldo_total))}
            {data.saldo_total > 0 ? ' (Debe)' : data.saldo_total < 0 ? ' (A favor)' : ''}
          </div>
          {data.saldo_a_favor > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00AEEF]/10 text-[#00AEEF]">
              Saldo a favor: {formatCurrency(data.saldo_a_favor)}
            </div>
          )}
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Fechas */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <div className="flex flex-col sm:flex-row gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="hidden sm:block w-px h-10 bg-gray-200 mx-2"></div>

            {/* Tipo de Cuenta */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="w-4 h-4" />
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo de Deuda</label>
                <select
                  value={tipoCuenta}
                  onChange={(e) => setTipoCuenta(e.target.value)}
                  className="px-3 py-2 pr-8 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-all outline-none appearance-none"
                >
                  <option value="">Consolidado (Ambas)</option>
                  <option value="factura">Blanco (Facturas)</option>
                  <option value="remito">Negro (Remitos)</option>
                </select>
              </div>
            </div>

            {(fechaDesde || fechaHasta || tipoCuenta) && (
              <button
                type="button"
                onClick={() => { setFechaDesde(''); setFechaHasta(''); setTipoCuenta('') }}
                className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors"
              >
                Limpiar Filtros
              </button>
            )}
          </div>

          <button
            onClick={handleExportPdf}
            disabled={exporting || loading || (!data || data.movimientos.length === 0)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] transition-all shadow-lg shadow-[#003087]/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none w-full lg:w-auto"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Emitir Estado de Cuenta (PDF)
          </button>
        </div>
      </div>

      {/* Movimientos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#003087]" />
          </div>
        ) : !data || data.movimientos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay movimientos para mostrar</p>
          </div>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Número</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Descripción</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Debe</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Haber</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movimientos.map((mov: CuentaCorrienteMovimiento, index: number) => (
                    <tr key={index} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(mov.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          mov.tipo === 'Pago' || mov.tipo === 'NC'
                            ? 'bg-green-100 text-green-700'
                            : mov.tipo === 'Pedido' || mov.tipo === 'ND'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{mov.numero}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{mov.descripcion || '-'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {mov.debe > 0 ? (
                          <span className="font-semibold text-red-600">{formatCurrency(mov.debe)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {mov.haber > 0 ? (
                          <span className="font-semibold text-green-600">{formatCurrency(mov.haber)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-bold ${
                          mov.saldo > 0 ? 'text-red-600' : mov.saldo < 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {formatCurrency(Math.abs(mov.saldo))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {data.movimientos.map((mov: CuentaCorrienteMovimiento, index: number) => (
                <div key={index} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        mov.tipo === 'Pago' || mov.tipo === 'NC'
                          ? 'bg-green-100 text-green-700'
                          : mov.tipo === 'Pedido' || mov.tipo === 'ND'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {mov.tipo}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{mov.numero}</span>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(mov.fecha)}</span>
                  </div>
                  {mov.descripcion && (
                    <p className="text-xs text-gray-500 truncate">{mov.descripcion}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-4">
                      {mov.debe > 0 && (
                        <div>
                          <span className="text-[10px] uppercase text-gray-400 block">Debe</span>
                          <span className="text-sm font-semibold text-red-600">{formatCurrency(mov.debe)}</span>
                        </div>
                      )}
                      {mov.haber > 0 && (
                        <div>
                          <span className="text-[10px] uppercase text-gray-400 block">Haber</span>
                          <span className="text-sm font-semibold text-green-600">{formatCurrency(mov.haber)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-gray-400 block">Saldo</span>
                      <span className={`text-sm font-bold ${
                        mov.saldo > 0 ? 'text-red-600' : mov.saldo < 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {formatCurrency(Math.abs(mov.saldo))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
