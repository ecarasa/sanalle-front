'use client'

import { useRef, useState } from 'react'
import { X, Package, FileDown, Loader2, Paperclip, ExternalLink, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { IngresoMercaderia } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  ingreso: IngresoMercaderia | null
  onClose: () => void
  onUpdate?: (updated: IngresoMercaderia) => void
}

export default function IngresoDetalleModal({ ingreso, onClose, onUpdate }: Props) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingArchivo, setDeletingArchivo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadPdf = async () => {
    if (!ingreso) return
    setDownloadingPdf(true)
    try {
      const res = await api.get(`/ingresos-mercaderia/${ingreso.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `OC_${ingreso.numero}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !ingreso) return
    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<IngresoMercaderia>(`/ingresos-mercaderia/${ingreso.id}/archivo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Factura adjuntada correctamente')
      onUpdate?.(res.data)
    } catch {
      toast.error('Error al subir la factura')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteArchivo = async () => {
    if (!ingreso) return
    setDeletingArchivo(true)
    try {
      const res = await api.delete<IngresoMercaderia>(`/ingresos-mercaderia/${ingreso.id}/archivo`)
      toast.success('Factura eliminada')
      onUpdate?.(res.data)
    } catch {
      toast.error('Error al eliminar la factura')
    } finally {
      setDeletingArchivo(false)
    }
  }

  if (!ingreso) return null

  const totalCajas = ingreso.items.reduce((sum, i) => sum + i.cantidad_cajas, 0)
  const totalBlisters = ingreso.items.reduce((sum, i) => sum + i.cantidad_blisters, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00AEEF]/10">
              <Package className="w-5 h-5 text-[#00AEEF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{ingreso.numero}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                  ingreso.destino === 'A'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  Stock {ingreso.destino}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{ingreso.proveedor_nombre || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors disabled:opacity-50"
              title="Descargar Orden de Compra PDF"
            >
              {downloadingPdf
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileDown className="w-3.5 h-3.5" />}
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</span>
              <p className="text-gray-800 font-medium mt-0.5">{formatDate(ingreso.fecha)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">N° Comprobante</span>
              <p className="text-gray-800 font-medium mt-0.5">{ingreso.numero_comprobante || '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Creado por</span>
              <p className="text-gray-800 font-medium mt-0.5">{ingreso.creado_por_nombre || '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vencimiento</span>
              <p className="text-gray-800 font-medium mt-0.5">
                {ingreso.fecha_vencimiento
                  ? formatDate(ingreso.fecha_vencimiento.split('T')[0])
                  : '—'}
              </p>
            </div>
            {ingreso.observacion && (
              <div className="col-span-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Observación</span>
                <p className="text-gray-700 mt-0.5">{ingreso.observacion}</p>
              </div>
            )}
          </div>

          {/* Factura adjunta */}
          <div className="rounded-xl border border-gray-100 p-4">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-3">
              Factura del proveedor
            </span>
            {ingreso.archivo_url ? (
              <div className="flex items-center gap-2">
                <a
                  href={ingreso.archivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex-1 min-w-0"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Ver factura adjunta</span>
                </a>
                <button
                  type="button"
                  onClick={handleDeleteArchivo}
                  disabled={deletingArchivo}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 shrink-0"
                  title="Eliminar factura adjunta"
                >
                  {deletingArchivo
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {uploading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Paperclip className="w-3.5 h-3.5" />}
                  {uploading ? 'Subiendo...' : 'Adjuntar factura PDF'}
                </button>
              </>
            )}
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#003087]/5 rounded-xl p-4 border border-[#003087]/10">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Importe Total</p>
              <p className="text-2xl font-black text-[#003087] mt-1">{formatCurrency(ingreso.importe_total)}</p>
            </div>
            <div className={`rounded-xl p-4 border ${
              ingreso.saldo_pendiente > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo Pendiente</p>
              <p className={`text-2xl font-black mt-1 ${ingreso.saldo_pendiente > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatCurrency(ingreso.saldo_pendiente)}
              </p>
            </div>
          </div>

          {/* Payment history */}
          {(ingreso.imputaciones?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Historial de Pagos ({ingreso.imputaciones.length})
              </h3>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Referencia</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ingreso.imputaciones.map((imp) => (
                      <tr key={imp.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-700">{formatDate(imp.fecha_pago.split('T')[0])}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#003087]/10 text-[#003087] capitalize">
                            {imp.tipo_pago}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{imp.referencia_pago || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(imp.importe_aplicado)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200 bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right uppercase tracking-wide">Total pagado</td>
                      <td className="px-4 py-2.5 text-right font-black text-green-700 text-sm">
                        {formatCurrency(ingreso.imputaciones.reduce((s, i) => s + i.importe_aplicado, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Items table */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Productos ({ingreso.items.length})
            </h3>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cajas</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Blisters</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Costo Unit.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ingreso.items.map((item, idx) => {
                    const subtotal = item.costo_unitario != null
                      ? item.costo_unitario * item.cantidad_cajas
                      : null
                    return (
                      <tr key={item.id ?? idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.producto_nombre || `Producto #${item.producto_id}`}</td>
                        <td className="px-3 py-3 text-center text-gray-700 font-semibold">{item.cantidad_cajas}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{item.cantidad_blisters > 0 ? item.cantidad_blisters : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {item.costo_unitario != null ? formatCurrency(item.costo_unitario) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#003087]">
                          {subtotal != null ? formatCurrency(subtotal) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer summary */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-sm text-gray-500">
            <span>
              {totalCajas} caja{totalCajas !== 1 ? 's' : ''}
              {totalBlisters > 0 ? ` + ${totalBlisters} blister${totalBlisters !== 1 ? 's' : ''}` : ''}
              {' '}en total
            </span>
            <span className="font-bold text-[#003087] text-base">{formatCurrency(ingreso.importe_total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
