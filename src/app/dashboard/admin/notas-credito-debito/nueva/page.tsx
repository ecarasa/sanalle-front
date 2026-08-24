'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, FileText, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { Cliente, Deposito, Producto, PaginatedResponse } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface NotaItem {
  producto_id: number | null
  descripcion: string
  cantidad_cajas: number
  cantidad_blisters: number
  precio_unitario: number
  precio_total: number
  blisters_por_caja?: number
}

const emptyItem: NotaItem = {
  producto_id: null,
  descripcion: '',
  cantidad_cajas: 0,
  cantidad_blisters: 0,
  precio_unitario: 0,
  precio_total: 0,
}

export default function NuevaNotaPage() {
  useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tipo = (searchParams.get('tipo') as 'credito' | 'debito') || 'credito'

  const [clienteId, setClienteId] = useState<number | null>(null)
  const [tipoCuenta, setTipoCuenta] = useState<'remito' | 'factura'>('remito')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const debouncedClienteSearch = useDebounce(clienteSearch, 300)

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [motivo, setMotivo] = useState('')
  const [afectaStock, setAfectaStock] = useState(false)
  // Depósito afectado cuando la nota mueve stock (antes era stock A/B fijo).
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [depositoId, setDepositoId] = useState<number | null>(null)
  const [items, setItems] = useState<NotaItem[]>([{ ...emptyItem }])

  const [productoSearch, setProductoSearch] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
  const [showProductoDropdown, setShowProductoDropdown] = useState(false)
  const debouncedProductoSearch = useDebounce(productoSearch, 300)

  const [saving, setSaving] = useState(false)

  // Depósitos, para cuando la nota afecta stock.
  useEffect(() => {
    api.get<Deposito[]>('/depositos')
      .then((res) => {
        const activos = (res.data ?? []).filter((d) => d.activo)
        setDepositos(activos)
        setDepositoId((prev) => prev ?? activos[0]?.id ?? null)
      })
      .catch(() => toast.error('Error al cargar depósitos'))
  }, [])

  // Search clientes
  useEffect(() => {
    if (!debouncedClienteSearch.trim()) {
      setClientes([])
      return
    }
    const fetch = async () => {
      try {
        const res = await api.get<PaginatedResponse<Cliente>>('/clientes', {
          params: { search: debouncedClienteSearch, page_size: 10 },
        })
        setClientes(res.data.items)
      } catch { /* ignore */ }
    }
    fetch()
  }, [debouncedClienteSearch])

  // Search productos
  useEffect(() => {
    if (!debouncedProductoSearch.trim()) {
      setProductos([])
      return
    }
    const fetch = async () => {
      try {
        const res = await api.get<PaginatedResponse<Producto>>('/productos', {
          params: { search: debouncedProductoSearch, page_size: 10 },
        })
        setProductos(res.data.items)
      } catch { /* ignore */ }
    }
    fetch()
  }, [debouncedProductoSearch])

  const selectCliente = (cliente: Cliente) => {
    setClienteId(cliente.id)
    setClienteSearch(cliente.nombre)
    setShowClienteDropdown(false)
  }

  const selectProducto = (producto: Producto, index: number) => {
    const updated = [...items]
    const precio = producto.precio_venta_minorista || producto.pvp || 0
    const bpx = producto.blisters_por_caja || 1
    
    updated[index] = {
      ...updated[index],
      producto_id: producto.id,
      descripcion: producto.nombre,
      precio_unitario: precio,
      blisters_por_caja: bpx,
    }
    
    // Default to 1 box if both are 0
    if (updated[index].cantidad_cajas === 0 && updated[index].cantidad_blisters === 0) {
      updated[index].cantidad_cajas = 1
    }
    
    const cantEquivalent = updated[index].cantidad_cajas + (updated[index].cantidad_blisters / bpx)
    updated[index].precio_total = cantEquivalent * precio
    
    setItems(updated)
    setShowProductoDropdown(false)
    setProductoSearch('')
    setActiveItemIndex(null)
  }

  const updateItem = (index: number, field: keyof NotaItem, value: string | number) => {
    const updated = [...items]
    const item = { ...updated[index], [field]: value }
    
    if (field === 'cantidad_cajas' || field === 'cantidad_blisters' || field === 'precio_unitario') {
      const bpx = item.blisters_por_caja || 1
      const cantEquivalent = Number(item.cantidad_cajas) + (Number(item.cantidad_blisters) / bpx)
      item.precio_total = cantEquivalent * Number(item.precio_unitario)
    }
    
    updated[index] = item
    setItems(updated)
  }

  const addItem = () => {
    setItems([...items, { ...emptyItem }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => sum + (item.precio_total || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteId) {
      toast.error('Seleccione un cliente')
      return
    }
    if (items.some((item) => !item.descripcion.trim())) {
      toast.error('Complete la descripcion de todos los items')
      return
    }

    setSaving(true)
    try {
      await api.post('/notas-credito-debito', {
        tipo,
        tipo_cuenta: tipoCuenta,
        cliente_id: clienteId,
        fecha,
        motivo: motivo || null,
        items: items.map((item) => ({
          producto_id: item.producto_id,
          descripcion: item.descripcion,
          cantidad_cajas: Number(item.cantidad_cajas),
          cantidad_blisters: Number(item.cantidad_blisters),
          precio_unitario: Number(item.precio_unitario),
          precio_total: Number(item.precio_total),
        })),
        afecta_stock: afectaStock,
        deposito_id: afectaStock ? depositoId : null,
      })
      toast.success(`Nota de ${tipo} creada correctamente`)
      router.push('/dashboard/admin/notas-credito-debito')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al crear nota')
    } finally {
      setSaving(false)
    }
  }

  const isCredito = tipo === 'credito'

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
          <div className={`p-2 rounded-lg ${isCredito ? 'bg-green-100' : 'bg-red-100'}`}>
            <FileText className={`w-6 h-6 ${isCredito ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Nueva Nota de {isCredito ? 'Credito' : 'Debito'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Complete los datos para crear la nota</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cliente Selector */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={clienteSearch}
                onChange={(e) => {
                  setClienteSearch(e.target.value)
                  setClienteId(null)
                  setShowClienteDropdown(true)
                }}
                onFocus={() => setShowClienteDropdown(true)}
                placeholder="Buscar cliente..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              />
            </div>
            {showClienteDropdown && clientes.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                {clientes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCliente(c)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium">{c.nombre}</span>
                    {c.cuit && <span className="text-gray-400 ml-2">CUIT: {c.cuit}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

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
              Tipo de Cuenta <span className="text-red-500">*</span>
            </label>
            <select
              value={tipoCuenta}
              onChange={(e) => setTipoCuenta(e.target.value as 'remito' | 'factura')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
              required
            >
              <option value="remito">Remitos por Cobrar </option>
              <option value="factura">Facturas por Cobrar </option>
            </select>
          </div>

          <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100 sm:col-span-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="afectaStock"
                checked={afectaStock}
                onChange={(e) => setAfectaStock(e.target.checked)}
                className="w-4 h-4 text-[#003087] rounded focus:ring-[#003087]"
              />
              <label htmlFor="afectaStock" className="text-sm font-medium text-gray-700 cursor-pointer">
                Afectar Stock
              </label>
            </div>

            {afectaStock && (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Depósito:</span>
                <select
                  value={depositoId ?? ''}
                  onChange={(e) => setDepositoId(e.target.value ? Number(e.target.value) : null)}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                >
                  <option value="">Elegí el depósito</option>
                  {depositos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
            rows={2}
            placeholder="Motivo de la nota..."
          />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Producto search */}
                  <div className="sm:col-span-4 relative">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Producto / Descripcion</label>
                    <input
                      type="text"
                      value={activeItemIndex === index ? productoSearch : item.descripcion}
                      onChange={(e) => {
                        if (activeItemIndex !== index) {
                          setActiveItemIndex(index)
                        }
                        setProductoSearch(e.target.value)
                        updateItem(index, 'descripcion', e.target.value)
                        setShowProductoDropdown(true)
                      }}
                      onFocus={() => {
                        setActiveItemIndex(index)
                        setProductoSearch(item.descripcion)
                        setShowProductoDropdown(true)
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowProductoDropdown(false), 200)
                      }}
                      placeholder="Buscar producto o escribir descripcion..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    />
                    {showProductoDropdown && activeItemIndex === index && productos.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
                        {productos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectProducto(p, index)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium block">{p.nombre}</span>
                                <span className="text-xs text-gray-400">
                                  {p.presentacion || 'S/P'} {p.categoria_producto && `| ${p.categoria_producto}`}
                                </span>
                              </div>
                              <span className="font-semibold">{formatCurrency(p.precio_venta_minorista || 0)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cajas</label>
                    <input
                      type="number"
                      min="0"
                      value={item.cantidad_cajas}
                      onChange={(e) => updateItem(index, 'cantidad_cajas', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Blis.</label>
                    <input
                      type="number"
                      min="0"
                      value={item.cantidad_blisters}
                      onChange={(e) => updateItem(index, 'cantidad_blisters', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unit.</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.precio_unitario}
                      onChange={(e) => updateItem(index, 'precio_unitario', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Subtotal</label>
                    <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                      {formatCurrency(item.precio_total)}
                    </div>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar item"
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

        {/* Total */}
        <div className="flex justify-end">
          <div className={`px-6 py-3 rounded-xl ${isCredito ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className="text-sm text-gray-600 mr-3">Total:</span>
            <span className={`text-xl font-bold ${isCredito ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${isCredito ? 'bg-green-600 hover:bg-green-700' : 'bg-[#E31837] hover:bg-[#c41530]'
              }`}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear Nota de {isCredito ? 'Credito' : 'Debito'}
          </button>
        </div>
      </form>
    </div>
  )
}
