'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, Package, Search, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { Deposito, Producto, Proveedor, PaginatedResponse, Laboratorio } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ProductoModal from '@/components/admin/ProductoModal'

interface IngresoItem {
  producto_id: number | null
  producto_nombre: string
  cantidad_cajas: number
  cantidad_blisters: number
  costo_unitario: number       // costo neto por caja
  blisters_por_caja: number
}

interface ImpuestoLinea {
  tipo_iva_id: number | null
  concepto: string
  tasa: number
  importe: number
  importeManual: boolean
}

interface ConceptoImpositivo {
  id: number
  nombre: string
  tasa: number
  tipo: string
}

const emptyItem: IngresoItem = {
  producto_id: null,
  producto_nombre: '',
  cantidad_cajas: 1,
  cantidad_blisters: 0,
  costo_unitario: 0,
  blisters_por_caja: 1,
}

function netoLinea(item: IngresoItem): number {
  const bpc = item.blisters_por_caja || 1
  const cajasEq = Number(item.cantidad_cajas || 0) + Number(item.cantidad_blisters || 0) / bpc
  return (Number(item.costo_unitario) || 0) * cajasEq
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function NuevoIngresoPage() {
  useAuth()
  const router = useRouter()

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [fechaVencimiento, setFechaVencimiento] = useState(new Date().toISOString().split('T')[0])
  const [proveedorId, setProveedorId] = useState<number | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [observacion, setObservacion] = useState('')
  const [items, setItems] = useState<IngresoItem[]>([{ ...emptyItem }])
  const [impuestos, setImpuestos] = useState<ImpuestoLinea[]>([])
  const [catalogo, setCatalogo] = useState<ConceptoImpositivo[]>([])

  const [sociedad, setSociedad] = useState('Sanalle')
  // Depósito al que entra la mercadería. Ya no se deduce de la sociedad.
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [depositoId, setDepositoId] = useState<number | null>(null)

  const [productoSearch, setProductoSearch] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
  const [showProductoDropdown, setShowProductoDropdown] = useState(false)
  const debouncedProductoSearch = useDebounce(productoSearch, 300)
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([])
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Load proveedores + laboratorios + catálogo de impuestos/percepciones
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<PaginatedResponse<Proveedor>>('/proveedores', { params: { page_size: 100 } })
        setProveedores(res.data.items)
        const lRes = await api.get<PaginatedResponse<Laboratorio>>('/laboratorios', { params: { page_size: 1000 } })
        setLaboratorios(lRes.data.items)
        const iRes = await api.get<PaginatedResponse<ConceptoImpositivo>>('/tipo-iva', { params: { solo_activos: true, page_size: 200 } })
        setCatalogo(iRes.data.items)
      } catch { /* ignore */ }
    })()
  }, [])

  // Depósitos disponibles: el primero queda preseleccionado.
  useEffect(() => {
    api.get<Deposito[]>('/depositos')
      .then((res) => {
        const activos = (res.data ?? []).filter((d) => d.activo)
        setDepositos(activos)
        setDepositoId((prev) => prev ?? activos[0]?.id ?? null)
      })
      .catch(() => toast.error('Error al cargar depósitos'))
  }, [])

  // Auto-calculate Due Date based on provider's plazo_pago
  useEffect(() => {
    if (!proveedorId || !fecha) return
    const prov = proveedores.find(p => p.id === proveedorId)
    if (prov) {
      const days = Number(prov.plazo_pago) || 30
      const d = new Date(fecha)
      d.setDate(d.getDate() + days)
      setFechaVencimiento(d.toISOString().split('T')[0])
    }
  }, [proveedorId, fecha, proveedores])

  // Search productos
  useEffect(() => {
    if (!debouncedProductoSearch.trim()) {
      setProductos([])
      return
    }
    const fetch = async () => {
      try {
        const params: Record<string, string | number> = { search: debouncedProductoSearch, page_size: 10 }
        if (proveedorId) params.proveedor_id = proveedorId
        const res = await api.get<PaginatedResponse<Producto>>('/productos', { params })
        setProductos(res.data.items)
      } catch { /* ignore */ }
    }
    fetch()
  }, [debouncedProductoSearch, proveedorId])

  const subtotalNeto = useMemo(
    () => round2(items.reduce((s, i) => s + (i.producto_id ? netoLinea(i) : 0), 0)),
    [items],
  )

  // Al cambiar el subtotal, recalcular el importe de las percepciones no editadas a mano.
  useEffect(() => {
    setImpuestos(prev => prev.map(imp =>
      imp.importeManual ? imp : { ...imp, importe: round2(subtotalNeto * imp.tasa / 100) },
    ))
  }, [subtotalNeto])

  const totalImpuestos = useMemo(() => round2(impuestos.reduce((s, i) => s + (Number(i.importe) || 0), 0)), [impuestos])
  const total = round2(subtotalNeto + totalImpuestos)

  const selectProducto = (producto: Producto, index: number) => {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      costo_unitario: Number(producto.costo_neto) || 0,
      blisters_por_caja: Number(producto.blisters_por_caja) || 1,
    }
    setItems(updated)
    setShowProductoDropdown(false)
    setProductoSearch('')
    setActiveItemIndex(null)
  }

  const handleProductSaved = (newProd?: Producto) => {
    if (newProd && activeItemIndex !== null) selectProducto(newProd, activeItemIndex)
    setShowModal(false)
  }

  const updateItem = (index: number, field: keyof IngresoItem, value: string | number) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const addItem = () => setItems([...items, { ...emptyItem }])
  const removeItem = (index: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)) }

  // --- Impuestos / percepciones ---
  const addImpuesto = () => setImpuestos([...impuestos, { tipo_iva_id: null, concepto: '', tasa: 0, importe: 0, importeManual: false }])
  const removeImpuesto = (index: number) => setImpuestos(impuestos.filter((_, i) => i !== index))
  const selectConcepto = (index: number, tipoIvaId: number) => {
    const concepto = catalogo.find(c => c.id === tipoIvaId)
    if (!concepto) return
    setImpuestos(prev => prev.map((imp, i) => i === index ? {
      tipo_iva_id: concepto.id,
      concepto: concepto.nombre,
      tasa: Number(concepto.tasa) || 0,
      importe: round2(subtotalNeto * (Number(concepto.tasa) || 0) / 100),
      importeManual: false,
    } : imp))
  }
  const editImporteImpuesto = (index: number, value: number) => {
    setImpuestos(prev => prev.map((imp, i) => i === index ? { ...imp, importe: value, importeManual: true } : imp))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proveedorId) { toast.error('Debe seleccionar un proveedor'); return }
    if (!numeroComprobante.trim()) { toast.error('El N° de comprobante es obligatorio'); return }
    if (!depositoId) { toast.error('Elegí el depósito al que entra la mercadería'); return }
    const validItems = items.filter((item) => item.producto_id !== null)
    if (validItems.length === 0) { toast.error('Agregue al menos un producto'); return }
    if (validItems.some((item) => Number(item.cantidad_cajas) <= 0 && Number(item.cantidad_blisters) <= 0)) {
      toast.error('Cargá cantidad de cajas o blísters en cada producto'); return
    }
    const impuestosValidos = impuestos.filter(i => i.concepto && (Number(i.importe) || 0) !== 0)

    setSaving(true)
    try {
      await api.post('/ingresos-mercaderia', {
        fecha,
        fecha_vencimiento: fechaVencimiento,
        deposito_id: depositoId,
        proveedor_id: proveedorId,
        numero_comprobante: numeroComprobante.trim(),
        observacion: observacion || null,
        items: validItems.map((item) => ({
          producto_id: item.producto_id,
          cantidad_cajas: Number(item.cantidad_cajas) || 0,
          cantidad_blisters: Number(item.cantidad_blisters) || 0,
          costo_unitario: Number(item.costo_unitario) || 0,
        })),
        impuestos: impuestosValidos.map((imp) => ({
          tipo_iva_id: imp.tipo_iva_id,
          concepto: imp.concepto,
          base: subtotalNeto,
          tasa: Number(imp.tasa) || 0,
          importe: Number(imp.importe) || 0,
        })),
      })
      toast.success('Compra registrada correctamente')
      router.push('/dashboard/admin/ingresos-mercaderia')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al registrar ingreso')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]'

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#00AEEF]/10">
            <Package className="w-6 h-6 text-[#00AEEF]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva compra</h1>
            <p className="text-sm text-gray-500">Ingreso de mercadería: productos, costos, IVA y percepciones.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Cabecera */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-red-500">*</span></label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sociedad</label>
            <select value={sociedad} onChange={(e) => setSociedad(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="Sanalle">Sanalle</option>
              <option value="Farmacare">Farmacare</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Depósito <span className="text-red-500">*</span>
            </label>
            <select
              value={depositoId ?? ''}
              onChange={(e) => setDepositoId(e.target.value ? Number(e.target.value) : null)}
              className={`${inputCls} bg-white`}
              required
            >
              <option value="">Elegí el depósito</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento <span className="text-red-500">*</span></label>
            <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={`${inputCls} bg-white`} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <select
              value={proveedorId || ''}
              onChange={(e) => { setProveedorId(e.target.value ? Number(e.target.value) : null); setItems([{ ...emptyItem }]) }}
              className={`${inputCls} bg-white`}
              required
            >
              <option value="">-- Seleccionar proveedor --</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° Comprobante <span className="text-red-500">*</span></label>
            <input type="text" value={numeroComprobante} onChange={(e) => setNumeroComprobante(e.target.value)} placeholder="Ej: FC-0001-00012345" className={inputCls} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
            <input type="text" value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional..." className={inputCls} />
          </div>
        </div>

        {/* Productos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Productos</h3>
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar producto
            </button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Producto */}
                <div className="sm:col-span-4 relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Producto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      disabled={!proveedorId}
                      value={activeItemIndex === index ? productoSearch : item.producto_nombre}
                      onChange={(e) => { setActiveItemIndex(index); setProductoSearch(e.target.value); setShowProductoDropdown(true) }}
                      onFocus={() => {
                        if (!proveedorId) { toast.error('Primero seleccione un proveedor'); return }
                        setActiveItemIndex(index); setProductoSearch(item.producto_nombre); setShowProductoDropdown(true)
                      }}
                      onBlur={() => setTimeout(() => setShowProductoDropdown(false), 200)}
                      placeholder={proveedorId ? 'Buscar producto...' : 'Seleccione un proveedor primero'}
                      className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] ${!proveedorId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  {showProductoDropdown && activeItemIndex === index && (
                    <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-60 overflow-y-auto">
                      {productos.length > 0 ? productos.map((p) => (
                        <button key={p.id} type="button" onClick={() => selectProducto(p, index)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-900">{p.nombre}</span>
                            <span className="text-xs font-bold text-[#003087]">{formatCurrency(Number(p.costo_neto) || 0)} (neto)</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-500">Código: {p.codigo}</span>
                            <span className="text-xs text-gray-400">
                              Stock: {(p.stocks ?? []).reduce((acc, st) => acc + st.cajas, 0)}
                            </span>
                          </div>
                        </button>
                      )) : productoSearch.length > 2 && (
                        <div className="p-4 text-center"><p className="text-sm text-gray-500">No se encontraron productos</p></div>
                      )}
                      <button type="button" onClick={() => setShowModal(true)} className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-[#003087] bg-blue-50 hover:bg-blue-100 transition-colors border-t border-blue-100">
                        <Plus className="w-4 h-4" /> Crear &quot;{productoSearch}&quot; como nuevo
                      </button>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cajas</label>
                  <input type="number" min="0" value={item.cantidad_cajas} onChange={(e) => updateItem(index, 'cantidad_cajas', Number(e.target.value))} className={`${inputCls} text-center`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Blísters</label>
                  <input type="number" min="0" value={item.cantidad_blisters} onChange={(e) => updateItem(index, 'cantidad_blisters', Number(e.target.value))} className={`${inputCls} text-center`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Costo/caja (neto)</label>
                  <input type="number" min="0" step="0.01" value={item.costo_unitario} onChange={(e) => updateItem(index, 'costo_unitario', Number(e.target.value))} className={`${inputCls} text-right`} />
                </div>
                <div className="sm:col-span-1 text-right">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Neto</label>
                  <div className="py-2 text-sm font-bold text-gray-800">{formatCurrency(item.producto_id ? netoLinea(item) : 0)}</div>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Impuestos y percepciones */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Percent className="w-4 h-4 text-gray-400" /> Impuestos y percepciones</h3>
            <button type="button" onClick={addImpuesto} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>

          {impuestos.length === 0 ? (
            <p className="text-xs text-gray-400">Sin impuestos. Agregá IVA / percepciones si corresponde.</p>
          ) : (
            <div className="space-y-2">
              {impuestos.map((imp, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-end bg-gray-50 rounded-xl p-3">
                  <div className="col-span-6 sm:col-span-7">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
                    <select value={imp.tipo_iva_id ?? ''} onChange={(e) => selectConcepto(index, Number(e.target.value))} className={`${inputCls} bg-white`}>
                      <option value="">Elegí un concepto...</option>
                      {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({Number(c.tasa)}%)</option>)}
                    </select>
                  </div>
                  <div className="col-span-4 sm:col-span-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Importe</label>
                    <input type="number" min="0" step="0.01" value={imp.importe} onChange={(e) => editImporteImpuesto(index, Number(e.target.value))} className={`${inputCls} text-right`} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeImpuesto(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="flex justify-end pt-2">
          <div className="w-full sm:w-72 bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal neto</span><span className="font-medium">{formatCurrency(subtotalNeto)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Impuestos</span><span className="font-medium">{formatCurrency(totalImpuestos)}</span></div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200"><span>TOTAL</span><span className="text-[#003087]">{formatCurrency(total)}</span></div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all active:scale-95">Cancelar</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] shadow-lg shadow-[#003087]/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar compra
          </button>
        </div>
      </form>

      <ProductoModal
        open={showModal}
        editingProducto={null}
        proveedores={proveedores}
        laboratorios={laboratorios}
        initialProveedorId={proveedorId || undefined}
        onClose={() => setShowModal(false)}
        onSaved={handleProductSaved}
      />
    </div>
  )
}
