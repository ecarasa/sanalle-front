'use client'

import { useState, useEffect } from 'react'
import { Package, X, Loader2, DollarSign, ImageIcon, Globe, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { LISTAS, ListaDef, MargenField, listasDe } from '@/lib/listas'
import { CATEGORY_MARGINS, num, recalcularPrecios, toInput } from '@/lib/pricing'
import { Producto, Proveedor, Laboratorio } from '@/types'

interface ProductoForm {
  codigo: string
  nombre: string
  foto_url: string
  stock_minimo_cajas: string
  stock_minimo_blisters: string
  categoria_producto: string
  presentacion: string
  comprimidos_por_blister: string
  blisters_por_caja: string
  status: string
  vende_caja: boolean
  vende_blister: boolean
  vende_comprimido: boolean
  pvp: string
  margen_minorista: string
  margen_mayorista: string
  margen_comercio: string
  costo_porcentaje: string
  costo_neto: string
  costo_mas_iibb: string
  precio_venta_minorista: string
  precio_venta_mayorista: string
  precio_venta_comercio: string
  proveedor_id: string
  laboratorio_id: string
  url_pvp: string
  pvp_descripcion: string
  activo: boolean
}

const emptyForm: ProductoForm = {
  codigo: '',
  nombre: '',
  foto_url: '',
  stock_minimo_cajas: '0',
  stock_minimo_blisters: '0',
  categoria_producto: 'GENERICO',
  presentacion: '',
  comprimidos_por_blister: '',
  blisters_por_caja: '',
  status: 'activo',
  vende_caja: true,
  vende_blister: false,
  vende_comprimido: false,
  pvp: '',
  margen_minorista: CATEGORY_MARGINS.GENERICO.margen_minorista ?? '',
  margen_mayorista: CATEGORY_MARGINS.GENERICO.margen_mayorista ?? '',
  // Los márgenes de comercio arrancan VACÍOS: son opt-in por producto.
  margen_comercio: '',
  costo_porcentaje: '',
  costo_neto: '',
  costo_mas_iibb: '',
  precio_venta_minorista: '',
  precio_venta_mayorista: '',
  precio_venta_comercio: '',
  proveedor_id: '',
  laboratorio_id: '',
  url_pvp: '',
  pvp_descripcion: '',
  activo: true,
}

const LISTAS_BASE = LISTAS.filter((lista) => lista.grupo !== 'comercio')
const LISTAS_COMERCIO = listasDe('comercio')

interface Props {
  open: boolean
  editingProducto: Producto | null
  proveedores: Proveedor[]
  laboratorios: Laboratorio[]
  loadingOptions?: boolean
  onClose: () => void
  onSaved: (producto?: Producto) => void
  initialProveedorId?: number | null
}

export default function ProductoModal({ open, editingProducto, proveedores, laboratorios, loadingOptions, onClose, onSaved, initialProveedorId }: Props) {
  const [form, setForm] = useState<ProductoForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [fetchingPvp, setFetchingPvp] = useState(false)
  const [pvpOptions, setPvpOptions] = useState<{ descripcion: string; pvp: string }[] | null>(null)
  // Descripción sugerida (la que matchea la presentación o la ya guardada) para resaltarla.
  const [pvpSugerida, setPvpSugerida] = useState<string | null>(null)

  const handleFetchPvp = async () => {
    if (!form.url_pvp) {
      toast.error('Ingrese una URL válida primero')
      return
    }

    setFetchingPvp(true)
    setPvpOptions(null)
    try {
      const res = await api.get('/scraper/test-pvp-url', {
        params: {
          url: form.url_pvp,
          presentacion: form.presentacion || undefined,
          descripcion_guardada: form.pvp_descripcion || undefined,
        }
      })

      const opciones: { descripcion: string; pvp: string }[] = res.data.opciones || []

      if (opciones.length === 0) {
        toast.error('No se pudo extraer el PVP de esta URL')
      } else if (opciones.length === 1) {
        // Una sola presentación: se usa y se guarda directo.
        handlePickPvpOption(opciones[0])
      } else {
        // Varias: se muestran para elegir, resaltando la sugerida/guardada.
        setPvpSugerida(res.data.presentacion_alfabeta || form.pvp_descripcion || null)
        setPvpOptions(opciones)
        toast('Elegí la presentación correcta — se guarda para el scraper automático', { icon: '👇' })
      }
    } catch (err: unknown) {
      toast.error('Error al conectar con el verificador de precios')
    } finally {
      setFetchingPvp(false)
    }
  }

  const handlePickPvpOption = (opcion: { descripcion: string; pvp: string }) => {
    // Se guarda la descripción elegida: el scraper automático usará esta misma opción.
    setForm(prev => ({ ...prev, pvp: opcion.pvp, pvp_descripcion: opcion.descripcion }))
    setPvpOptions(null)
    setPvpSugerida(null)
    toast.success(`PVP: ${formatCurrency(parseFloat(opcion.pvp))} — se guardó "${opcion.descripcion}" para el scraper`)
  }

  useEffect(() => {
    if (!open) return
    setPvpOptions(null)
    if (editingProducto) {
      setForm({
        codigo: editingProducto.codigo,
        nombre: editingProducto.nombre,
        foto_url: editingProducto.foto_url || '',
        stock_minimo_cajas: String(editingProducto.stock_minimo_cajas),
        stock_minimo_blisters: String(editingProducto.stock_minimo_blisters),
        categoria_producto: editingProducto.categoria_producto || 'GENERICO',
        presentacion: editingProducto.presentacion || '',
        comprimidos_por_blister: editingProducto.comprimidos_por_blister != null ? String(editingProducto.comprimidos_por_blister) : '',
        blisters_por_caja: editingProducto.blisters_por_caja != null ? String(editingProducto.blisters_por_caja) : '',
        status: editingProducto.status || 'activo',
        vende_caja: (editingProducto as any).vende_caja ?? true,
        vende_blister: (editingProducto as any).vende_blister ?? false,
        vende_comprimido: (editingProducto as any).vende_comprimido ?? false,
        pvp: editingProducto.pvp != null ? String(editingProducto.pvp) : '',
        margen_minorista: editingProducto.margen_minorista != null ? String(editingProducto.margen_minorista) : '',
        margen_mayorista: editingProducto.margen_mayorista != null ? String(editingProducto.margen_mayorista) : '',
        margen_comercio: editingProducto.margen_comercio != null ? String(editingProducto.margen_comercio) : '',
        costo_porcentaje: editingProducto.costo_porcentaje != null ? String(editingProducto.costo_porcentaje) : '',
        costo_neto: editingProducto.costo_neto != null ? String(editingProducto.costo_neto) : '',
        costo_mas_iibb: editingProducto.costo_mas_iibb != null ? String(editingProducto.costo_mas_iibb) : '',
        precio_venta_minorista: editingProducto.precio_venta_minorista != null ? String(editingProducto.precio_venta_minorista) : '',
        precio_venta_mayorista: editingProducto.precio_venta_mayorista != null ? String(editingProducto.precio_venta_mayorista) : '',
        precio_venta_comercio: editingProducto.precio_venta_comercio != null ? String(editingProducto.precio_venta_comercio) : '',
        proveedor_id: editingProducto.proveedor_id != null ? String(editingProducto.proveedor_id) : '',
        laboratorio_id: (editingProducto as any).laboratorio_id != null ? String((editingProducto as any).laboratorio_id) : '',
        url_pvp: (editingProducto as any).url_pvp || '',
        pvp_descripcion: (editingProducto as any).pvp_descripcion || '',
        activo: editingProducto.status !== 'inactivo',
      })
    } else {
      setForm({
        ...emptyForm,
        proveedor_id: initialProveedorId !== undefined && initialProveedorId !== null ? String(initialProveedorId) : '',
      })
    }
  }, [open, editingProducto, initialProveedorId])

  // Cálculo en vivo (el backend recalcula igual al guardar; esto es sólo preview).
  // Un margen vacío => precio null => input vacío. NUNCA 0.
  useEffect(() => {
    if (!open) return

    const margenes: Partial<Record<MargenField, number | null>> = {}
    for (const lista of LISTAS) {
      margenes[lista.margenField] = num(form[lista.margenField])
    }

    const { costoNeto, costoMasIibb, precios } = recalcularPrecios(
      num(form.pvp),
      num(form.costo_porcentaje),
      margenes
    )

    const next: Partial<ProductoForm> = {
      costo_neto: toInput(costoNeto),
      costo_mas_iibb: toInput(costoMasIibb),
    }
    for (const lista of LISTAS) {
      next[lista.precioField] = toInput(precios[lista.key])
    }

    const cambio = (Object.keys(next) as (keyof ProductoForm)[]).some((campo) => form[campo] !== next[campo])
    if (cambio) {
      setForm((prev) => ({ ...prev, ...next }))
    }
  }, [open, form])

  // Márgenes por defecto de la categoría (sólo al crear). CATEGORY_MARGINS no trae
  // márgenes de comercio a propósito: esas listas quedan vacías (opt-in por producto).
  useEffect(() => {
    if (!open || editingProducto) return
    const defaults = CATEGORY_MARGINS[form.categoria_producto || 'GENERICO']
    if (!defaults) return
    setForm((prev) => {
      const next = { ...prev }
      for (const lista of LISTAS) {
        const valor = defaults[lista.margenField]
        if (valor !== undefined) next[lista.margenField] = valor
      }
      return next
    })
  }, [form.categoria_producto, open, editingProducto])

  const handleClose = () => {
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nombre.trim()) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setSaving(true)
    try {
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        foto_url: form.foto_url || null,
        stock_minimo_cajas: parseInt(form.stock_minimo_cajas) || 0,
        stock_minimo_blisters: parseInt(form.stock_minimo_blisters) || 0,
        categoria_producto: form.categoria_producto || null,
        presentacion: form.presentacion || null,
        comprimidos_por_blister: form.comprimidos_por_blister ? parseInt(form.comprimidos_por_blister) : null,
        blisters_por_caja: form.blisters_por_caja ? parseInt(form.blisters_por_caja) : null,
        status: form.activo ? 'activo' : 'inactivo',
        vende_caja: form.vende_caja,
        vende_blister: form.vende_blister,
        vende_comprimido: form.vende_comprimido,
        pvp: form.pvp ? parseFloat(form.pvp) : null,
        margen_minorista: form.margen_minorista ? parseFloat(form.margen_minorista) : null,
        margen_mayorista: form.margen_mayorista ? parseFloat(form.margen_mayorista) : null,
        margen_comercio: form.margen_comercio ? parseFloat(form.margen_comercio) : null,
        costo_porcentaje: form.costo_porcentaje ? parseFloat(form.costo_porcentaje) : null,
        costo_neto: form.costo_neto ? parseFloat(form.costo_neto) : null,
        costo_mas_iibb: form.costo_mas_iibb ? parseFloat(form.costo_mas_iibb) : null,
        precio_venta_minorista: form.precio_venta_minorista ? parseFloat(form.precio_venta_minorista) : null,
        precio_venta_mayorista: form.precio_venta_mayorista ? parseFloat(form.precio_venta_mayorista) : null,
        precio_venta_comercio: form.precio_venta_comercio ? parseFloat(form.precio_venta_comercio) : null,
        proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
        laboratorio_id: form.laboratorio_id ? parseInt(form.laboratorio_id) : null,
        url_pvp: form.url_pvp || null,
        pvp_descripcion: form.pvp_descripcion || null,
      }

      if (editingProducto) {
        const res = await api.put<Producto>(`/productos/${editingProducto.id}`, payload)
        toast.success('Producto actualizado correctamente')
        handleClose()
        onSaved(res.data)
      } else {
        const res = await api.post<Producto>('/productos', payload)
        toast.success('Producto creado correctamente')
        handleClose()
        onSaved(res.data)
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al guardar producto')
    } finally {
      setSaving(false)
    }
  }

  const setMargen = (campo: MargenField, value: string) => {
    setForm((prev) => ({ ...prev, [campo]: value }) as ProductoForm)
  }

  const renderLista = (lista: ListaDef) => {
    const precio = form[lista.precioField]
    return (
      <div key={lista.key} className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Margen {lista.short} %</label>
          <input
            type="number"
            step="0.1"
            value={form[lista.margenField]}
            onChange={(e) => setMargen(lista.margenField, e.target.value)}
            placeholder="—"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio {lista.short}</label>
          <div className="relative">
            <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${precio ? lista.colorClass : 'text-gray-300'}`} />
            <input
              type="text"
              value={precio ? formatCurrency(parseFloat(precio)) : ''}
              readOnly
              disabled
              placeholder="—"
              title="Calculado a partir del margen (lo recalcula el backend al guardar)"
              className={`w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 cursor-not-allowed font-bold ${precio ? lista.colorClass : 'text-gray-400'}`}
            />
          </div>
        </div>
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#003087]/10">
              <Package className="w-5 h-5 text-[#003087]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información General */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Información General</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codigo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={form.categoria_producto}
                  onChange={(e) => setForm({ ...form, categoria_producto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
                >
                  <option value="GENERICO">GENERICO</option>
                  <option value="OTC">OTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presentación</label>
                <input
                  type="text"
                  value={form.presentacion}
                  onChange={(e) => setForm({ ...form, presentacion: e.target.value })}
                  placeholder="Ej: Caja x 20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <select
                value={form.proveedor_id}
                onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}
                disabled={loadingOptions && proveedores.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {loadingOptions && proveedores.length === 0 ? 'Cargando proveedores…' : '— Sin proveedor —'}
                </option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio</label>
              <select
                value={form.laboratorio_id}
                onChange={(e) => setForm({ ...form, laboratorio_id: e.target.value })}
                disabled={loadingOptions && laboratorios.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {loadingOptions && laboratorios.length === 0 ? 'Cargando laboratorios…' : '— Sin laboratorio —'}
                </option>
                {laboratorios.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL Verificación PVP</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={form.url_pvp}
                    onChange={(e) => setForm({ ...form, url_pvp: e.target.value })}
                    placeholder="https://..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchPvp}
                  disabled={fetchingPvp || !form.url_pvp}
                  className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  title="Sincronizar PVP ahora"
                >
                  {fetchingPvp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span className="text-xs font-bold">Verificar</span>
                </button>
              </div>

              {form.pvp_descripcion && !pvpOptions && (
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Opción guardada para el scraper automático:{' '}
                  <span className="font-semibold text-gray-700">{form.pvp_descripcion}</span>
                </p>
              )}

              {pvpOptions && (
                <div className="mt-2 border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-800 font-medium mb-2">
                    Elegí la presentación correcta. La que elijas queda guardada y el scraper
                    automático la usa directo.
                  </p>
                  <div className="space-y-1">
                    {pvpOptions.map((op) => {
                      const esSugerida = op.descripcion === pvpSugerida
                      const esGuardada = op.descripcion === form.pvp_descripcion
                      return (
                      <button
                        key={op.descripcion}
                        type="button"
                        onClick={() => handlePickPvpOption(op)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 border rounded-md text-xs transition-colors hover:border-[#00AEEF] hover:bg-[#00AEEF]/5 ${
                          esSugerida ? 'border-[#00AEEF] bg-[#00AEEF]/5 ring-1 ring-[#00AEEF]/30' : 'bg-white border-gray-200'
                        }`}
                      >
                        <span className="text-gray-700 flex items-center gap-1.5">
                          {op.descripcion}
                          {esGuardada && <span className="text-[10px] font-bold text-green-600">✓ guardada</span>}
                          {esSugerida && !esGuardada && <span className="text-[10px] font-bold text-[#00AEEF]">sugerida</span>}
                        </span>
                        <span className="font-bold text-[#003087]">{formatCurrency(parseFloat(op.pvp))}</span>
                      </button>
                    )})}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detalles Farmacéuticos */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalles Farmacéuticos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprimidos / Blister</label>
                <input
                  type="number"
                  value={form.comprimidos_por_blister}
                  onChange={(e) => setForm({ ...form, comprimidos_por_blister: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blisters / Caja</label>
                <input
                  type="number"
                  value={form.blisters_por_caja}
                  onChange={(e) => setForm({ ...form, blisters_por_caja: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
            </div>

            {/* Formato de venta: en qué unidades se puede vender */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Formato de venta</p>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.vende_caja}
                    onChange={(e) => setForm({ ...form, vende_caja: e.target.checked })}
                    className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20"
                  />
                  Caja / Expendedor
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.vende_blister}
                    onChange={(e) => setForm({ ...form, vende_blister: e.target.checked })}
                    className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20"
                  />
                  Blíster
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-400 cursor-pointer" title="Reservado para catálogo (aún no disponible como unidad de pedido)">
                  <input
                    type="checkbox"
                    checked={form.vende_comprimido}
                    onChange={(e) => setForm({ ...form, vende_comprimido: e.target.checked })}
                    className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20"
                  />
                  Comprimido
                </label>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Ej.: expendedor cargado por caja pero vendido solo por blíster → destildá &quot;Caja&quot; y tildá &quot;Blíster&quot;.
              </p>
            </div>

            {/* El stock no se edita acá: se carga por depósito desde
                "Ajuste de stock", que deja movimiento y responsable. */}

            {/* Mínimos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock mínimo (cajas)</label>
                <input type="number" min="0" value={form.stock_minimo_cajas}
                  onChange={(e) => setForm({ ...form, stock_minimo_cajas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock mínimo (blisters)</label>
                <input type="number" min="0" value={form.stock_minimo_blisters}
                  onChange={(e) => setForm({ ...form, stock_minimo_blisters: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
              </div>
            </div>
          </div>

          {/* Precios y Costos */}
          <div className="space-y-4 pt-2 bg-gray-50 -mx-6 px-6 py-6 border-y border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Precios y Costos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PVP (Lista)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={form.pvp}
                    onChange={(e) => setForm({ ...form, pvp: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo % (Descuento)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.costo_porcentaje}
                  onChange={(e) => setForm({ ...form, costo_porcentaje: e.target.value })}
                  placeholder="Ej: 40"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="opacity-75">
                <label className="block text-xs font-medium text-gray-500 mb-1 italic">Costo Neto (Calc.)</label>
                <input
                  type="text"
                  value={form.costo_neto ? formatCurrency(parseFloat(form.costo_neto)) : ''}
                  disabled
                  placeholder="—"
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="opacity-75">
                <label className="block text-xs font-medium text-gray-500 mb-1 italic">Costo + IIBB (Calc.)</label>
                <input
                  type="text"
                  value={form.costo_mas_iibb ? formatCurrency(parseFloat(form.costo_mas_iibb)) : ''}
                  disabled
                  placeholder="—"
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {LISTAS_BASE.map(renderLista)}
            </div>

            {/* Lista Comercio (opt-in por producto) */}
            <div className="pt-4 mt-2 border-t border-gray-200 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-teal-700 uppercase tracking-wider">Lista Comercio</h4>
                <p className="text-xs text-gray-500 mt-1 italic">
                  Opcional — dejá el margen vacío si el producto no se vende en ese formato.
                </p>
              </div>
              {LISTAS_COMERCIO.map(renderLista)}
            </div>
          </div>

          {/* Media y Estado */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL</label>
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="url"
                    value={form.foto_url}
                    onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
                {form.foto_url ? (
                  <img src={form.foto_url} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" onError={(e) => (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error'} />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0">
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#003087]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#003087]" />
              </label>
              <span className="text-sm font-medium text-gray-700">Producto Activo</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-lg shadow-[#003087]/20 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProducto ? 'Actualizar Producto' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
