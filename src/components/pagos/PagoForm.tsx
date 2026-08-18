'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle2, FileText, Download, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Cliente, Proveedor } from '@/types'
import ClientSelector from '@/components/ui/ClientSelector'

const MEDIOS_PAGO = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Transferencia Bancaria', value: 'transferencia' },
  { label: 'Retención', value: 'retencion' },
] as const

type TipoPago = (typeof MEDIOS_PAGO)[number]['value']

interface Pedido {
  id: number
  numero_pedido: string
  saldo_pendiente: number
  fecha: string
}

interface PreviewImputacion {
  pedidoId: number
  numeroPedido: string
  saldoPendiente: number
  montoAImputar: number
}

interface IngresoItem {
  id: number
  numero: string
  numero_comprobante: string
  fecha: string
  saldo_pendiente: number
  fecha_vencimiento: string | null
}

interface PagoFormProps {
  initialClienteId?: number
}

export default function PagoForm({ initialClienteId }: PagoFormProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [clienteId, setClienteId] = useState<number | null>(initialClienteId || null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loadingCliente, setLoadingCliente] = useState(!!initialClienteId)

  // Form fields
  const [tipoPago, setTipoPago] = useState<TipoPago>('efectivo')
  const [tipoCuenta, setTipoCuenta] = useState<'remito' | 'factura'>('remito')
  const [importe, setImporte] = useState<number | ''>('')
  const [fechaRecepcion, setFechaRecepcion] = useState(() => {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  })
  const [observacion, setObservacion] = useState('')
  const [referencia, setReferencia] = useState('')

  // Cheque fields
  const [chBanco, setChBanco] = useState('')
  const [chNumero, setChNumero] = useState('')
  const [chFecha, setChFecha] = useState('')
  const [chVto, setChVto] = useState('')
  const [bancoId, setBancoId] = useState('')

  // Transferencia fields
  const [transferenciaNumero, setTransferenciaNumero] = useState('')
  const [transferenciaFecha, setTransferenciaFecha] = useState('')
  const [transferenciaCuentaOrigen, setTransferenciaCuentaOrigen] = useState('')

  // Retencion fields
  const [retencionTipo, setRetencionTipo] = useState('')
  const [retencionNumero, setRetencionNumero] = useState('')
  const [retencionFecha, setRetencionFecha] = useState('')

  // Bancos dropdown
  const [bancos, setBancos] = useState<{ id: number; nombre: string }[]>([])

  // Auto-imputar
  const [autoImputar, setAutoImputar] = useState(false)
  const [previewImputaciones, setPreviewImputaciones] = useState<PreviewImputacion[]>([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)

  // Pagar a proveedor
  const [pagarProveedor, setPagarProveedor] = useState(false)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loadingProveedores, setLoadingProveedores] = useState(false)
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [ingresosPendientes, setIngresosPendientes] = useState<IngresoItem[]>([])
  const [loadingIngresos, setLoadingIngresos] = useState(false)
  const [ingresosSeleccionados, setIngresosSeleccionados] = useState<Record<number, string>>({})
  const [selectedIngresoIds, setSelectedIngresoIds] = useState<Set<number>>(new Set())

  // Submit state
  const [saving, setSaving] = useState(false)

  // Success modal state
  const [successModal, setSuccessModal] = useState(false)
  const [pagoId, setPagoId] = useState<number | null>(null)
  const [numeroRecibo, setNumeroRecibo] = useState('')

  // Computed totals
  const totalImputado = previewImputaciones.reduce((s, i) => s + i.montoAImputar, 0)
  const totalProveedorSeleccionado = Array.from(selectedIngresoIds).reduce(
    (sum, id) => sum + (parseFloat(ingresosSeleccionados[id] || '0') || 0),
    0
  )

  // Fetch bancos
  useEffect(() => {
    api.get('/bancos', { params: { page_size: 100 } })
      .then(res => setBancos(res.data.items || []))
      .catch(() => { })
  }, [])

  // Fetch client if ID changes
  useEffect(() => {
    if (!clienteId) {
      setCliente(null)
      return
    }
    const fetchCliente = async () => {
      setLoadingCliente(true)
      try {
        const res = await api.get<Cliente>(`/clientes/${clienteId}`)
        setCliente(res.data)
      } catch {
        toast.error('Error al cargar datos del cliente')
      } finally {
        setLoadingCliente(false)
      }
    }
    fetchCliente()
  }, [clienteId])

  // Auto-imputar preview
  useEffect(() => {
    if (!autoImputar || !importe || !clienteId) {
      setPreviewImputaciones([])
      return
    }
    const fetchAndPreview = async () => {
      setLoadingPedidos(true)
      try {
        const res = await api.get(`/pedidos/${clienteId}/pedidos_a_imputar`)
        const pedidos: Pedido[] = res.data.pedidos || res.data
        let remaining = Number(importe)
        const preview: PreviewImputacion[] = []
        for (const p of pedidos) {
          if (remaining <= 0) break
          const aplicar = Math.min(remaining, p.saldo_pendiente)
          preview.push({
            pedidoId: p.id,
            numeroPedido: p.numero_pedido,
            saldoPendiente: p.saldo_pendiente,
            montoAImputar: aplicar,
          })
          remaining -= aplicar
        }
        setPreviewImputaciones(preview)
      } catch {
        toast.error('Error al cargar pedidos pendientes')
      } finally {
        setLoadingPedidos(false)
      }
    }
    fetchAndPreview()
  }, [autoImputar, importe, clienteId])

  // Fetch proveedores list when toggle is on
  useEffect(() => {
    if (!pagarProveedor || proveedores.length > 0) return
    setLoadingProveedores(true)
    api.get('/proveedores', { params: { page_size: 500 } })
      .then(res => setProveedores(res.data.items || res.data))
      .catch(() => toast.error('Error al cargar proveedores'))
      .finally(() => setLoadingProveedores(false))
  }, [pagarProveedor, proveedores.length])

  // Fetch ingresos pendientes when provider is selected
  useEffect(() => {
    if (!pagarProveedor || !proveedorId) {
      setIngresosPendientes([])
      setSelectedIngresoIds(new Set())
      setIngresosSeleccionados({})
      return
    }
    setLoadingIngresos(true)
    api.get(`/proveedores/${proveedorId}/ingresos-pendientes`)
      .then(res => {
        const data: IngresoItem[] = res.data
        setIngresosPendientes(data)
        const ids = new Set(data.map(i => i.id))
        const montos: Record<number, string> = {}
        data.forEach(i => { montos[i.id] = i.saldo_pendiente.toFixed(2) })
        setSelectedIngresoIds(ids)
        setIngresosSeleccionados(montos)
      })
      .catch(() => toast.error('Error al cargar ingresos pendientes'))
      .finally(() => setLoadingIngresos(false))
  }, [pagarProveedor, proveedorId])

  const toggleIngreso = (ing: IngresoItem, checked: boolean) => {
    const next = new Set(selectedIngresoIds)
    if (checked) {
      next.add(ing.id)
      setIngresosSeleccionados(prev => ({ ...prev, [ing.id]: ing.saldo_pendiente.toFixed(2) }))
    } else {
      next.delete(ing.id)
      setIngresosSeleccionados(prev => {
        const copy = { ...prev }
        delete copy[ing.id]
        return copy
      })
    }
    setSelectedIngresoIds(next)
  }

  const handleSubmit = async () => {
    if (!clienteId) {
      toast.error('Debe seleccionar un cliente primero')
      return
    }
    if (!importe || importe <= 0) {
      toast.error('El importe debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        cliente_id: clienteId,
        tipo_pago: tipoPago,
        tipo_cuenta: tipoCuenta,
        importe: Number(importe),
        fecha_recepcion: fechaRecepcion,
        observacion: observacion || null,
        referencia: referencia || null,
        auto_imputar: autoImputar,
        // Si además paga a un proveedor, el cobro es un pasamanos (cuenta puente):
        // la plata entra sólo para salir, no impacta la caja real.
        es_puente: pagarProveedor,
      }

      if (tipoPago === 'cheque') {
        payload.ch_banco = chBanco || null
        payload.ch_numero = chNumero || null
        payload.ch_fecha = chFecha || null
        payload.ch_vto = chVto || null
        payload.banco_id = bancoId ? Number(bancoId) : null
      }

      if (tipoPago === 'transferencia') {
        payload.transferencia_numero = transferenciaNumero || null
        payload.transferencia_fecha = transferenciaFecha || null
        payload.transferencia_cuenta_origen = transferenciaCuentaOrigen || null
        payload.banco_id = bancoId ? Number(bancoId) : null
      }

      if (tipoPago === 'retencion') {
        payload.retencion_tipo = retencionTipo || null
        payload.retencion_numero = retencionNumero || null
        payload.retencion_fecha = retencionFecha || null
      }

      // Step 1: create the pago
      const pagoRes = await api.post('/pagos', payload)
      const newPagoId: number = pagoRes.data.id
      setPagoId(newPagoId)
      setNumeroRecibo(pagoRes.data.numero_recibo)

      // Step 2: pay selected ingresos linked to this pago
      if (pagarProveedor && proveedorId && selectedIngresoIds.size > 0) {
        const ingresos = Array.from(selectedIngresoIds)
          .map(id => ({ id, monto: parseFloat(ingresosSeleccionados[id] || '0') }))
          .filter(i => i.monto > 0)

        if (ingresos.length > 0) {
          await api.post(`/proveedores/${proveedorId}/pagar`, {
            ingresos,
            metodo_pago: tipoPago,
            aplicar_descuento: false,
            aplicar_cashback: false,
            pago_id: newPagoId,
            fecha: fechaRecepcion,
          })
        }
      }

      setSuccessModal(true)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Error al registrar el pago')
    } finally {
      setSaving(false)
    }
  }

  const viewPdf = async () => {
    if (!pagoId) return
    try {
      const res = await api.get(`/pagos/${pagoId}/recibo`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      const pdfWindow = window.open('', '_blank')
      if (pdfWindow) {
        pdfWindow.document.write(
          `<html><head><title>Recibo ${numeroRecibo}</title><style>body{margin:0}</style></head>` +
          `<body><iframe src="${blobUrl}" style="width:100%;height:100vh;border:none;"></iframe></body></html>`
        )
        pdfWindow.document.close()
      }
    } catch {
      toast.error('Error al abrir el recibo')
    }
  }

  const downloadPdf = async () => {
    if (!pagoId) return
    try {
      const res = await api.get(`/pagos/${pagoId}/recibo`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${numeroRecibo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar el recibo')
    }
  }

  const closeSuccessModal = () => {
    setSuccessModal(false)
    router.push('/dashboard/pagos')
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-50 disabled:text-gray-500'
  const toggleClass = 'w-11 h-6 rounded-full transition-colors'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Nuevo Pago {cliente ? `— ${cliente.nombre}` : ''}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Registrá un nuevo pago {cliente ? 'de este cliente' : ''}</p>
        </div>
      </div>

      {/* Client Selector (if no initial client is provided or even if provided, we can show it disabled) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Seleccionar Cliente</h2>
        <ClientSelector
          selectedClienteId={clienteId}
          onClientSelect={setClienteId}
          disabled={!!initialClienteId}
        />
      </div>

      {loadingCliente ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#003087]" />
        </div>
      ) : !clienteId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          Seleccione un cliente para continuar con el pago
        </div>
      ) : (
        <>
          {/* Main form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del Pago</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Medio de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago</label>
                <select value={tipoPago} onChange={(e) => setTipoPago(e.target.value as TipoPago)} className={inputClass}>
                  {MEDIOS_PAGO.map((medio) => (
                    <option key={medio.value} value={medio.value}>{medio.label}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Cuenta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
                <select
                  value={tipoCuenta}
                  onChange={(e) => setTipoCuenta(e.target.value as 'remito' | 'factura')}
                  className={inputClass}
                >
                  <option value="remito">Remitos por Cobrar</option>
                  <option value="factura">Facturas por Cobrar</option>
                </select>
              </div>

              {/* Importe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Importe</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={importe}
                    onChange={(e) => setImporte(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
              </div>

              {/* Receptor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receptor</label>
                <input
                  type="text"
                  value={user?.nombre_completo || user?.username || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              {/* Fecha Recepción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Recepción</label>
                <input
                  type="datetime-local"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / N° Operación</label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="N° de operación o referencia"
                  className={inputClass}
                />
              </div>

              {/* Observación */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Observaciones del pago..."
                />
              </div>
            </div>

            {/* Cheque fields */}
            {tipoPago === 'cheque' && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Datos del Cheque</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numero de Cheque</label>
                    <input type="text" value={chNumero} onChange={(e) => setChNumero(e.target.value)} placeholder="Numero del cheque" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banco (texto)</label>
                    <input type="text" value={chBanco} onChange={(e) => setChBanco(e.target.value)} placeholder="Nombre del banco" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banco (seleccionar)</label>
                    <select value={bancoId} onChange={(e) => setBancoId(e.target.value)} className={`${inputClass} bg-white`}>
                      <option value="">-- Seleccionar banco --</option>
                      {bancos.map((b) => (<option key={b.id} value={b.id}>{b.nombre}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Cheque</label>
                    <input type="date" value={chFecha} onChange={(e) => setChFecha(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento del Cheque</label>
                    <input type="date" value={chVto} onChange={(e) => setChVto(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
            )}

            {/* Transferencia fields */}
            {tipoPago === 'transferencia' && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Datos de la Transferencia</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numero de Transferencia</label>
                    <input type="text" value={transferenciaNumero} onChange={(e) => setTransferenciaNumero(e.target.value)} placeholder="Numero de operacion" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Transferencia</label>
                    <input type="date" value={transferenciaFecha} onChange={(e) => setTransferenciaFecha(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Origen</label>
                    <input type="text" value={transferenciaCuentaOrigen} onChange={(e) => setTransferenciaCuentaOrigen(e.target.value)} placeholder="Cuenta de origen" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                    <select value={bancoId} onChange={(e) => setBancoId(e.target.value)} className={`${inputClass} bg-white`}>
                      <option value="">-- Seleccionar banco --</option>
                      {bancos.map((b) => (<option key={b.id} value={b.id}>{b.nombre}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Retencion fields */}
            {tipoPago === 'retencion' && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Datos de la Retención</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Retención</label>
                    <input type="text" value={retencionTipo} onChange={(e) => setRetencionTipo(e.target.value)} placeholder="Ej: IVA, Ganancias, IIBB..." className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numero de Retención</label>
                    <input type="text" value={retencionNumero} onChange={(e) => setRetencionNumero(e.target.value)} placeholder="Numero de comprobante" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Retención</label>
                    <input type="date" value={retencionFecha} onChange={(e) => setRetencionFecha(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auto-imputar card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Imputación Automática</h2>
                <p className="text-sm text-gray-500 mt-0.5">Aplicar automáticamente a los pedidos pendientes más antiguos</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoImputar}
                  onChange={(e) => setAutoImputar(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`${toggleClass} bg-gray-200 peer-checked:bg-emerald-600`} />
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            {autoImputar && (
              <div className="mt-4">
                {loadingPedidos ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin text-[#003087]" /> Cargando pedidos...
                  </div>
                ) : previewImputaciones.length === 0 ? (
                  <p className="text-sm text-gray-400">No hay pedidos pendientes para este cliente.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vista previa de imputación</p>
                    {previewImputaciones.map((imp) => (
                      <div key={imp.pedidoId} className="flex items-center justify-between text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700">Pedido #{imp.numeroPedido}</span>
                        <span className="text-gray-400">Saldo: {formatCurrency(imp.saldoPendiente)}</span>
                        <span className="font-semibold text-emerald-700">Aplica: {formatCurrency(imp.montoAImputar)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                      <span className="text-gray-700">Total imputado a pedidos:</span>
                      <span className="text-emerald-700">{formatCurrency(totalImputado)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pagar a Proveedor card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pagar a Proveedor <span className="text-xs font-medium text-blue-600">(cuenta puente)</span></h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Usar este cobro para pagar a un proveedor (pasamanos). La plata entra y sale: se registra como tránsito y no impacta la caja real.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pagarProveedor}
                  onChange={(e) => setPagarProveedor(e.target.checked)}
                  className="sr-only peer"
                  max={importe}
                />
                <div className={`${toggleClass} bg-gray-200 peer-checked:bg-blue-600`} />
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            {pagarProveedor && (
              <div className="mt-4 space-y-4">
                {/* Proveedor selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  {loadingProveedores ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#003087]" /> Cargando...
                    </div>
                  ) : (
                    <select
                      value={proveedorId}
                      onChange={(e) => setProveedorId(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="">-- Seleccionar proveedor --</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Ingresos pendientes checklist */}
                {proveedorId && (
                  <div>
                    {loadingIngresos ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#003087]" /> Cargando comprobantes...
                      </div>
                    ) : ingresosPendientes.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Sin deuda pendiente con este proveedor.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Comprobantes Pendientes ({ingresosPendientes.length})
                          </p>
                          <a
                            href="/dashboard/admin/proveedores"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#003087] hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Ver en Proveedores
                          </a>
                        </div>

                        {ingresosPendientes.map((ing) => {
                          const isSelected = selectedIngresoIds.has(ing.id)
                          return (
                            <div
                              key={ing.id}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => toggleIngreso(ing, e.target.checked)}
                                className="w-4 h-4 accent-blue-600 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {ing.numero}{ing.numero_comprobante ? ` · ${ing.numero_comprobante}` : ''}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(ing.fecha)}
                                  {ing.fecha_vencimiento && (
                                    <span className="ml-2 text-orange-500">
                                      Vence: {formatDate(ing.fecha_vencimiento)}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs text-gray-400 mb-1">
                                  Saldo: {formatCurrency(ing.saldo_pendiente)}
                                </p>
                                {isSelected && (
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      max={ing.saldo_pendiente}
                                      value={ingresosSeleccionados[ing.id] ?? ''}
                                      onChange={(e) =>
                                        setIngresosSeleccionados(prev => ({
                                          ...prev,
                                          [ing.id]: e.target.value,
                                        }))
                                      }
                                      className="w-28 pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#003087]/20"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {selectedIngresoIds.size > 0 && (
                          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
                            <span className="text-gray-600">Total a pagar al proveedor:</span>
                            <span className="text-blue-700">{formatCurrency(totalProveedorSeleccionado)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !importe || importe <= 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Pago
            </button>
          </div>
        </>
      )}

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Pago registrado correctamente</h3>
              <p className="text-sm text-gray-500 mb-1">Número de recibo:</p>
              <p className="text-lg font-bold text-[#003087] mb-6">{numeroRecibo}</p>
              <div className="flex flex-col w-full gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={viewPdf}
                    className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium text-[#003087] bg-blue-50 border border-[#003087]/20 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Ver PDF
                  </button>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeSuccessModal}
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mt-2"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
