'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Loader2, Calendar, Search, ChevronLeft, ChevronRight, ExternalLink, Trash2, AlertTriangle, Wallet, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

interface TransLink { tipo: string; id: number; label: string }
interface Contraparte { tipo: 'cliente' | 'proveedor'; id: number; nombre: string }
interface Transaccion {
  key: string
  tipo: string
  tipo_label: string
  fecha: string
  importe: number
  direccion: 'ingreso' | 'egreso' | 'ajuste' | 'transito'
  numero: string
  metodo_pago: string | null
  cuenta: string | null
  contraparte: Contraparte | null
  links: TransLink[]
  descripcion: string | null
}
interface Resumen { ingresos: number; egresos: number; neto: number; transito?: number }
interface Respuesta {
  items: Transaccion[]
  total: number
  page: number
  page_size: number
  resumen: Resumen
}

const TIPO_BADGE: Record<string, string> = {
  cobro: 'bg-green-100 text-green-700',
  pago_proveedor: 'bg-red-100 text-red-700',
  nota_credito: 'bg-emerald-100 text-emerald-700',
  nota_debito: 'bg-amber-100 text-amber-700',
  nota_proveedor: 'bg-gray-100 text-gray-600',
}

const TIPO_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'cobro', label: 'Cobros' },
  { value: 'pago_proveedor', label: 'Pagos a proveedor' },
  { value: 'nota_credito', label: 'Notas de crédito' },
  { value: 'nota_debito', label: 'Notas de débito' },
  { value: 'nota_proveedor', label: 'Notas de proveedor' },
]

// Cada link/contraparte navega a su pantalla real.
function urlContraparte(c: Contraparte): string {
  return c.tipo === 'cliente'
    ? `/dashboard/clientes/${c.id}/cuenta-corriente`
    : `/dashboard/admin/proveedores`
}
function urlLink(l: TransLink): string {
  if (l.tipo === 'pedido') return `/dashboard/pedidos/${l.id}/editar`
  if (l.tipo === 'compra') return `/dashboard/admin/ingresos-mercaderia`
  return '/dashboard'
}

export default function TransaccionesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<Respuesta | null>(null)
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState('')
  const [search, setSearch] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [cuentaNombre, setCuentaNombre] = useState<string | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setCuentaId(searchParams.get('cuenta_id'))
    setCuentaNombre(searchParams.get('cuenta_nombre'))
  }, [searchParams])

  const quitarFiltroCuenta = useCallback(() => {
    setCuentaId(null)
    setCuentaNombre(null)
    router.replace('/dashboard/transacciones')
  }, [router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: pageSize }
      if (tipo) params.tipo = tipo
      if (search) params.search = search
      if (fechaDesde) params.fecha_desde = fechaDesde
      if (fechaHasta) params.fecha_hasta = fechaHasta
      if (cuentaId) params.cuenta_id = cuentaId
      const res = await api.get<Respuesta>('/transacciones', { params })
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tipo, search, fechaDesde, fechaHasta, cuentaId, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [tipo, search, fechaDesde, fechaHasta, cuentaId])

  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false)
    setConfirmText('')
  }, [])

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await api.delete('/transacciones', { params: { confirmar: 'ELIMINAR' } })
      toast.success(`${res.data.eliminadas} transacciones eliminadas`)
      closeDeleteModal()
      setPage(1)
      fetchData()
    } catch {
      toast.error('Error al eliminar las transacciones')
    } finally {
      setDeleting(false)
    }
  }, [closeDeleteModal, fetchData])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#003087] rounded-lg">
          <ArrowLeftRight className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
          <p className="text-sm text-gray-500">Cobros, pagos a proveedor y notas, con sus links a pedidos y compras.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          disabled={!data || data.total === 0}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#E31837] rounded-lg hover:bg-[#c01530] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar todas
        </button>
      </div>

      {/* Resumen */}
      {data && (
        <div className={`grid grid-cols-1 gap-4 ${data.resumen.transito ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100"><ArrowDownCircle className="w-6 h-6 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Ingresos</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(data.resumen.ingresos)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-100"><ArrowUpCircle className="w-6 h-6 text-red-600" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Egresos</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(data.resumen.egresos)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#003087]/10"><ArrowLeftRight className="w-6 h-6 text-[#003087]" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Neto</p>
              <p className={`text-xl font-bold ${data.resumen.neto >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.resumen.neto)}</p>
            </div>
          </div>
          {!!data.resumen.transito && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-100"><ArrowLeftRight className="w-6 h-6 text-[#00AEEF]" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Tránsito (pasamanos)</p>
                <p className="text-xl font-bold text-[#00AEEF]">{formatCurrency(data.resumen.transito)}</p>
                <p className="text-[10px] text-gray-400">No impacta la caja</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtro de cuenta (llegó desde la pantalla de Cuentas) */}
      {cuentaId && (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#003087]/10 text-[#003087] text-sm font-medium w-fit">
          <Wallet className="w-4 h-4" />
          Filtrando por cuenta: {cuentaNombre || `#${cuentaId}`}
          <button type="button" onClick={quitarFiltroCuenta} className="p-0.5 rounded hover:bg-[#003087]/10" title="Quitar filtro">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente / proveedor..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
          {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="px-2 py-2 text-sm border border-gray-300 rounded-lg" />
          <span>–</span>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="px-2 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-8 h-8 animate-spin text-[#003087]" /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">No hay transacciones para los filtros elegidos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Contraparte</th>
                  <th className="px-4 py-3 text-left">Asociado a</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((t) => (
                  <tr key={t.key} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(t.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${TIPO_BADGE[t.tipo] || 'bg-gray-100 text-gray-600'}`}>
                        {t.tipo_label}
                      </span>
                      {t.metodo_pago && <span className="block text-[10px] text-gray-400 mt-0.5 capitalize">{t.metodo_pago}</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{t.numero}</td>
                    <td className="px-4 py-3">
                      {t.contraparte ? (
                        <button
                          type="button"
                          onClick={() => router.push(urlContraparte(t.contraparte!))}
                          className="inline-flex items-center gap-1 text-[#003087] hover:underline"
                        >
                          {t.contraparte.nombre}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.links.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.links.map((l, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => router.push(urlLink(l))}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#00AEEF]/10 text-[#0086c3] hover:bg-[#00AEEF]/20"
                              title={l.tipo === 'pedido' ? 'Ir al pedido' : 'Ir a la compra'}
                            >
                              {l.tipo === 'pedido' ? 'Pedido' : 'Compra'} {l.label}
                            </button>
                          ))}
                        </div>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${t.direccion === 'ingreso' ? 'text-green-600' : t.direccion === 'egreso' ? 'text-red-600' : t.direccion === 'transito' ? 'text-[#00AEEF]' : 'text-gray-700'}`}>
                      {t.direccion === 'egreso' ? '-' : t.direccion === 'ingreso' ? '+' : t.direccion === 'transito' ? '↔ ' : ''}{formatCurrency(t.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {data && data.total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span>{data.total} transacciones</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmación de borrado total */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDeleteModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100">
                <AlertTriangle className="w-6 h-6 text-[#E31837]" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Eliminar todas las transacciones</h2>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Esta acción borra <strong>todos</strong> los cobros de cliente, pagos a proveedor y
              notas de crédito/débito, junto con sus imputaciones. Los pedidos vuelven a quedar como
              <strong> sin pagos</strong>. Es <strong>irreversible</strong>.
            </p>
            <p className="text-sm text-gray-600 mb-2">
              Para confirmar, escribí <span className="font-mono font-bold text-[#E31837]">ELIMINAR</span>:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#E31837]/30 focus:border-[#E31837]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={confirmText !== 'ELIMINAR' || deleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#E31837] rounded-lg hover:bg-[#c01530] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
