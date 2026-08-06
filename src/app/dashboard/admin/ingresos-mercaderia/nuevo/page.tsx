'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, Package, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { Producto, Proveedor, PaginatedResponse, Laboratorio } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ProductoModal from '@/components/admin/ProductoModal'

interface IngresoItem {
  producto_id: number | null
  producto_nombre: string
  cantidad_cajas: number
  cantidad_blisters: number
  costo_unitario: number
  costo_iibb: number

}

const emptyItem: IngresoItem = {
  producto_id: null,
  producto_nombre: '',
  cantidad_cajas: 1,
  cantidad_blisters: 0,
  costo_unitario: 0,
  costo_iibb: 0,
}

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

  const [sociedad, setSociedad] = useState('Sanalle')

  const [productoSearch, setProductoSearch] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
  const [showProductoDropdown, setShowProductoDropdown] = useState(false)
  const debouncedProductoSearch = useDebounce(productoSearch, 300)
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([])
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Load proveedores
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const res = await api.get<PaginatedResponse<Proveedor>>('/proveedores', { params: { page_size: 100 } })
        setProveedores(res.data.items)
        const lRes = await api.get<PaginatedResponse<Laboratorio>>('/laboratorios', { params: { page_size: 1000 } })
        setLaboratorios(lRes.data.items)
      } catch { /* ignore */ }
    }
    fetchProveedores()
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
        const params: any = { search: debouncedProductoSearch, page_size: 10 }
        if (proveedorId) {
          params.proveedor_id = proveedorId
        }
        const res = await api.get<PaginatedResponse<Producto>>('/productos', { params })
        setProductos(res.data.items)
      } catch { /* ignore */ }
    }
    fetch()
  }, [debouncedProductoSearch, proveedorId])

  const selectProducto = (producto: Producto, index: number) => {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      costo_unitario: Number(producto.costo_neto) || 0,
      costo_iibb: Number(producto.costo_mas_iibb) || 0,
    }
    setItems(updated)
    setShowProductoDropdown(false)
    setProductoSearch('')
    setActiveItemIndex(null)
  }

  const handleProductSaved = (newProd?: Producto) => {
    if (newProd && activeItemIndex !== null) {
      selectProducto(newProd, activeItemIndex)
    }
    setShowModal(false)
  }

  const updateItem = (index: number, field: keyof IngresoItem, value: string | number) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const addItem = () => {
    setItems([...items, { ...emptyItem }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proveedorId) {
      toast.error('Debe seleccionar un proveedor')
      return
    }
    if (!numeroComprobante.trim()) {
      toast.error('El N° de comprobante es obligatorio')
      return
    }
    const validItems = items.filter((item) => item.producto_id !== null)
    if (validItems.length === 0) {
      toast.error('Agregue al menos un producto')
      return
    }
    if (validItems.some((item) => Number(item.cantidad_cajas) <= 0)) {
      toast.error('La cantidad de cajas debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      await api.post('/ingresos-mercaderia', {
        fecha,
        fecha_vencimiento: fechaVencimiento,
        destino: 'A',
        proveedor_id: proveedorId,
        numero_comprobante: numeroComprobante.trim(),
        observacion: observacion || null,
        items: validItems.map((item) => ({
          producto_id: item.producto_id,
          cantidad_cajas: Number(item.cantidad_cajas),
          cantidad_blisters: 0,
          costo_unitario: sociedad === "Sanalle" ? Number(item.costo_iibb) : Number(item.costo_unitario) || null,
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
          <div className="p-2 rounded-lg bg-[#00AEEF]/10">
            <Package className="w-6 h-6 text-[#00AEEF]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nuevo Registro de Compra</h1>
            <p className="text-sm text-gray-500 mt-1">Registre las cajas compradas al laboratorio</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sociedad
            </label>
            <select
              value={sociedad}
              required
              onChange={(e) => setSociedad(e.target.value as 'Sanalle' | 'Farmacare' | '')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
            >
              <option value="Sanalle">Sanalle</option>
              <option value="Farmacare">Farmacare</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Vencimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              N° Comprobante <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              placeholder="Ej: FC-0001-00012345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <select
              value={proveedorId || ''}
              onChange={(e) => {
                setProveedorId(e.target.value ? Number(e.target.value) : null)
                setItems([{ ...emptyItem }]) // Reset items when provider changes to avoid mixups
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
              required
            >
              <option value="">-- Seleccionar proveedor --</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
            <input
              type="text"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Observación opcional..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Productos</h3>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Producto
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Producto search */}
                  <div className="sm:col-span-4 relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Producto</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        disabled={!proveedorId}
                        value={activeItemIndex === index ? productoSearch : item.producto_nombre}
                        onChange={(e) => {
                          setActiveItemIndex(index)
                          setProductoSearch(e.target.value)
                          setShowProductoDropdown(true)
                        }}
                        onFocus={() => {
                          if (!proveedorId) {
                            toast.error('Primero seleccione un proveedor')
                            return
                          }
                          setActiveItemIndex(index)
                          setProductoSearch(item.producto_nombre)
                          setShowProductoDropdown(true)
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowProductoDropdown(false), 200)
                        }}
                        placeholder={proveedorId ? "Buscar producto..." : "Seleccione un proveedor primero"}
                        className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] ${!proveedorId ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    {showProductoDropdown && activeItemIndex === index && (
                      <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-60 overflow-y-auto">
                        {productos.length > 0 ? (
                          productos.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => selectProducto(p, index)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">{p.nombre}</span>
                                <span className="text-xs font-bold text-[#003087]">{formatCurrency(Number(p.pvp) || 0)} (PVP)</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-gray-500">Codigo: {p.codigo}</span>
                                <div className="flex gap-2">
                                  <span className="text-xs text-gray-400">Dto: {p.costo_porcentaje}%</span>
                                  <span className="text-xs text-gray-400">Stock: {p.stock_a_cajas}</span>
                                </div>
                              </div>
                            </button>
                          ))
                        ) : productoSearch.length > 2 && (
                          <div className="p-4 text-center">
                            <p className="text-sm text-gray-500 mb-2">No se encontraron productos</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowModal(true)}
                          className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-[#003087] bg-blue-50 hover:bg-blue-100 transition-colors border-t border-blue-100"
                        >
                          <Plus className="w-4 h-4" />
                          Crear "{productoSearch}" como Nuevo
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cant. Cajas</label>
                    <input
                      type="number"
                      min="0"
                      value={item.cantidad_cajas}
                      onChange={(e) => updateItem(index, 'cantidad_cajas', Number(e.target.value))}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] text-center"
                    />
                  </div>

                  {
                    sociedad === "Sanalle" ? (
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Costo Unit. (Con IIBB)</label>
                        <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm font-bold text-gray-700">
                          {formatCurrency(item.costo_iibb)}
                        </div>
                      </div>
                    ) : (
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Costo Unit. (Neto)</label>
                        <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm font-bold text-gray-700">

                          {formatCurrency(item.costo_unitario)}
                        </div>
                      </div>
                    )
                  }

                  <div className="sm:col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="flex justify-end pt-4">
          <div className="bg-[#00AEEF]/10 px-6 py-4 rounded-xl shadow-sm border border-[#00AEEF]/20">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">Total productos:</span>
              <span className="text-2xl font-black text-[#00AEEF]">
                {items.filter((i) => i.producto_id !== null).length}
              </span>
              <div className="h-8 w-px bg-[#00AEEF]/20 mx-2" />
              <span className="text-sm text-gray-500">
                {items.reduce((sum, i) => sum + (i.producto_id ? Number(i.cantidad_cajas) : 0), 0)} cajas totales
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] shadow-lg shadow-[#003087]/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar Ingreso
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
