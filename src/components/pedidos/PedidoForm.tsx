'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Search, ArrowLeft, Package, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { RadioGroup, Radio, DatePicker, DateInput, DateSegment as DateSegmentInput } from 'react-aria-components'
import { parseDate, today, getLocalTimeZone, type DateValue } from '@internationalized/date'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { Producto, User } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import {
  GRUPO_LABEL,
  GRUPO_OPTIONS,
  LISTAS,
  esGrupo,
  listaDe,
  type Grupo,
  type ListaKey,
} from '@/lib/listas'
import {
  UNIDAD_LABEL,
  unidadesDeProducto,
  precioBasePorUnidad,
  type UnidadVenta,
} from '@/lib/ventas'

// Re-export para compatibilidad con importaciones existentes.
export { UNIDAD_LABEL, unidadesDeProducto, precioBasePorUnidad }
export type { UnidadVenta }

export type PreciosProducto = Partial<Record<ListaKey, number | null>>

export interface PedidoItemLocal {
  producto_id: number
  producto_nombre: string
  presentacion: string | null
  cantidad: number
  /** Unidad de venta de la línea (caja/blister). */
  unidad_venta: UnidadVenta
  precio_lista: number | null
  descuento_porcentaje: number | null
  precio_unitario: number
  precio_total: number
  /** Precios del producto por lista. null = no se vende en esa lista. */
  producto_precios: PreciosProducto
  /** blisters_por_caja del producto, para recalcular al cambiar de lista. */
  blisters_por_caja: number | null
}

/** Arma el dict de precios por lista a partir de un producto de la grilla admin. */
export const preciosDeProducto = (producto: Producto): PreciosProducto =>
  LISTAS.reduce<PreciosProducto>((acc, lista) => {
    acc[lista.key] = producto[lista.precioField] ?? null
    return acc
  }, {})

/**
 * Precio base de una línea según la lista del grupo (minorista/mayorista/comercio).
 * null = ese producto no se vende en esa lista (nunca 0).
 */
export const precioDeLista = (
  precios: PreciosProducto | undefined,
  grupo: Grupo
): number | null => {
  if (!precios) return null
  const lista = listaDe(grupo)
  if (!lista) return null
  return precios[lista.key] ?? null
}

interface PedidoFormProps {
  pedidoId: number
  clienteNombre?: string
  clienteTipo?: string
  clienteCondicionPago?: string | null
  clientePlazoDias?: number | null
  clienteDiasEntrega?: number | null
  /** Datos de dirección del cliente (se muestran y arman el default del envío). */
  clienteDomicilio?: string | null
  clienteLocalidad?: string | null
  clienteCodigoPostal?: string | null
  clienteProvincia?: string | null
  numeroPedido: string
  vendedorNombre?: string
  initialVendedorId?: number
  fechaCreacion?: string
  /** Fecha de creación en ISO (YYYY-MM-DD), editable. */
  initialFecha?: string | null

  initialTipoDocumento: 'remito' | 'factura'
  initialFechaEntrega: string | null
  initialObservacion: string
  initialTransporte?: string | null
  initialDireccionEntrega?: string | null
  initialSociedad?: string | null
  initialFechaCompromisoPago?: string | null
  initialDespachado?: boolean
  initialItems: PedidoItemLocal[]
  initialTipoPrecio?: Grupo | null
  initialBultos?: number

  isEditing: boolean
  onCancel: () => void
}

export default function PedidoForm({
  pedidoId,
  clienteNombre,
  clienteTipo,
  clienteCondicionPago,
  clientePlazoDias,
  clienteDiasEntrega,
  clienteDomicilio,
  clienteLocalidad,
  clienteCodigoPostal,
  clienteProvincia,
  numeroPedido,
  vendedorNombre,
  initialVendedorId,
  fechaCreacion,
  initialFecha,
  initialTipoDocumento,
  initialFechaEntrega,
  initialObservacion,
  initialTransporte,
  initialDireccionEntrega,
  initialSociedad,
  initialFechaCompromisoPago,
  initialDespachado,
  initialItems,
  initialTipoPrecio,
  initialBultos,
  isEditing,
  onCancel,
}: PedidoFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin'

  // --- Defaults de fechas (solo para pedido NUEVO) ---
  const tz = getLocalTimeZone()
  const hoy = today(tz)
  const manana = hoy.add({ days: 1 })
  // Días de entrega del cliente (>=0). Si no tiene, default 1 día (mañana).
  const diasEntregaCliente = clienteDiasEntrega != null && clienteDiasEntrega >= 0 ? clienteDiasEntrega : null
  const entregaDefault = diasEntregaCliente != null ? hoy.add({ days: diasEntregaCliente }) : manana
  // Plazo de pago del cliente: si tiene condición "plazo" con días, se usa para el compromiso.
  const plazoCliente = clienteCondicionPago === 'plazo' && clientePlazoDias && clientePlazoDias > 0
    ? clientePlazoDias
    : null
  const compromisoDefault = plazoCliente ? hoy.add({ days: plazoCliente }) : manana

  // Order fields
  const [tipoDocumento, setTipoDocumento] = useState<'remito' | 'factura'>(initialTipoDocumento)
  const [fechaEntrega, setFechaEntrega] = useState<DateValue | null>(() => {
    if (initialFechaEntrega) {
      try {
        return parseDate(initialFechaEntrega)
      } catch (e) {
        console.error('Error parsing date:', e)
      }
    }
    // Nuevo pedido: por defecto según los días de entrega del cliente (o mañana).
    return isEditing ? null : entregaDefault
  })
  // Fecha de creación editable (default: hoy).
  const [fechaCreacionDate, setFechaCreacionDate] = useState<DateValue | null>(() => {
    if (initialFecha) {
      try { return parseDate(initialFecha) } catch { /* noop */ }
    }
    return hoy
  })
  const [observacion, setObservacion] = useState(initialObservacion)
  const [transporte, setTransporte] = useState(initialTransporte || '')
  // Envío: campos editables por pedido (domicilio, localidad, CP, provincia), precargados del cliente.
  const componerDireccion = (dom?: string, loc?: string, prov?: string, cp?: string) =>
    ([dom, loc, prov].filter(Boolean).join(', ') + (cp ? ` (CP ${cp})` : '')).trim()
  const clienteDireccionDefault = componerDireccion(clienteDomicilio || '', clienteLocalidad || '', clienteProvincia || '', clienteCodigoPostal || '')
  const [envioDomicilio, setEnvioDomicilio] = useState(clienteDomicilio || '')
  const [envioLocalidad, setEnvioLocalidad] = useState(clienteLocalidad || '')
  const [envioCp, setEnvioCp] = useState(clienteCodigoPostal || '')
  const [envioProvincia, setEnvioProvincia] = useState(clienteProvincia || '')
  // Dirección de entrega final (lo que se guarda). Se recompone al editar los campos, o se edita libre.
  const [direccionEntrega, setDireccionEntrega] = useState(initialDireccionEntrega || clienteDireccionDefault || '')

  const onEnvioChange = (patch: Partial<{ dom: string; loc: string; cp: string; prov: string }>) => {
    const dom = patch.dom ?? envioDomicilio
    const loc = patch.loc ?? envioLocalidad
    const cp = patch.cp ?? envioCp
    const prov = patch.prov ?? envioProvincia
    if (patch.dom !== undefined) setEnvioDomicilio(patch.dom)
    if (patch.loc !== undefined) setEnvioLocalidad(patch.loc)
    if (patch.cp !== undefined) setEnvioCp(patch.cp)
    if (patch.prov !== undefined) setEnvioProvincia(patch.prov)
    setDireccionEntrega(componerDireccion(dom, loc, prov, cp))
  }
  const usarDireccionCliente = () => {
    setEnvioDomicilio(clienteDomicilio || '')
    setEnvioLocalidad(clienteLocalidad || '')
    setEnvioCp(clienteCodigoPostal || '')
    setEnvioProvincia(clienteProvincia || '')
    setDireccionEntrega(clienteDireccionDefault)
  }
  const [sociedad, setSociedad] = useState<'sanalle' | 'farmacare' | ''>(
    (initialSociedad as 'sanalle' | 'farmacare' | '') || ''
  )
  const [fechaCompromisoPago, setFechaCompromisoPago] = useState<DateValue | null>(() => {
    if (initialFechaCompromisoPago) {
      try {
        return parseDate(initialFechaCompromisoPago)
      } catch {
        return null
      }
    }
    // Nuevo pedido: por defecto según el plazo del cliente (o mañana).
    return isEditing ? null : compromisoDefault
  })
  const [despachado, setDespachado] = useState(initialDespachado || false)
  const [tipoPrecio, setTipoPrecio] = useState<Grupo>(() => {
    if (esGrupo(initialTipoPrecio)) return initialTipoPrecio
    if (esGrupo(clienteTipo)) return clienteTipo
    return 'minorista'
  })
  const [bultos, setBultos] = useState(initialBultos || 0)
  const [items, setItems] = useState<PedidoItemLocal[]>(initialItems)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const esComercio = tipoPrecio === 'comercio'
  const [vendedorId, setVendedorId] = useState<number | undefined>(initialVendedorId)
  const [vendedores, setVendedores] = useState<User[]>([])

  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const autoSavingRef = useRef(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebounce(productSearch, 200)
  // Catálogo COMPLETO precargado una sola vez → búsqueda instantánea en memoria.
  const [todosProductos, setTodosProductos] = useState<Producto[]>([])
  const [loadingTodos, setLoadingTodos] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null)
  const [modalCantidad, setModalCantidad] = useState<number>(1)
  const [modalPrecio, setModalPrecio] = useState<number>(0)
  const [modalDescuento, setModalDescuento] = useState<number>(0)
  const [modalPrecioLista, setModalPrecioLista] = useState<number>(0)
  const [modalUnidad, setModalUnidad] = useState<UnidadVenta>('caja')

  // Unidades de venta habilitadas para el producto elegido
  const modalUnidades = useMemo<UnidadVenta[]>(
    () => (selectedProduct ? unidadesDeProducto(selectedProduct) : ['caja']),
    [selectedProduct]
  )

  // Precios por lista del producto elegido en el modal
  const modalPrecios = useMemo<PreciosProducto>(
    () => (selectedProduct ? preciosDeProducto(selectedProduct) : {}),
    [selectedProduct]
  )
  // En un pedido de comercio, un producto sin precio de comercio no se puede agregar
  const modalSinPreciosComercio = esComercio && selectedProduct !== null && precioDeLista(modalPrecios, 'comercio') === null

  // Fetch sellers if admin
  useEffect(() => {
    if (isAdmin) {
      api.get<User[]>('/users/vendedores')
        .then(res => setVendedores(res.data))
        .catch(err => console.error('Error fetching sellers:', err))
    }
  }, [isAdmin])

  // Payload de ítems: única fuente de verdad para autosave y para finalizar.
  const itemsPayload = useMemo(
    () =>
      items.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        unidad_venta: item.unidad_venta,
        precio_lista: item.precio_lista,
        descuento_porcentaje: item.descuento_porcentaje,
        precio_unitario: item.precio_unitario,
        precio_total: item.precio_total,
      })),
    [items]
  )

  // Robust Auto-save logic (Debounced and duplicate-protected)
  const previousData = useRef<string | null>(null)

  useEffect(() => {
    const currentDataString = JSON.stringify({
      items: itemsPayload,
      tipoDocumento,
      fecha: fechaCreacionDate ? fechaCreacionDate.toString() : null,
      fechaEntrega: fechaEntrega ? fechaEntrega.toString() : null,
      observacion: observacion || null,
      transporte: transporte || null,
      direccionEntrega: direccionEntrega || null,
      sociedad: sociedad || null,
      fechaCompromisoPago: fechaCompromisoPago ? fechaCompromisoPago.toString() : null,
      despachado,
      tipo_precio: tipoPrecio,
      vendedor_id: vendedorId,
      bultos,
    })

    if (previousData.current === null) {
      previousData.current = currentDataString
      return
    }

    if (previousData.current === currentDataString) {
      return
    }

    previousData.current = currentDataString

    const timer = setTimeout(async () => {
      if (autoSavingRef.current || saving) return

      autoSavingRef.current = true
      setAutoSaving(true)
      try {
        await api.put(`/pedidos/${pedidoId}`, {
          tipo_documento: tipoDocumento,
          items: itemsPayload,
          observacion: observacion || null,
          fecha: fechaCreacionDate ? fechaCreacionDate.toString() : null,
          fecha_entrega: fechaEntrega ? fechaEntrega.toString() : null,
          transporte: transporte || null,
          direccion_entrega: direccionEntrega || null,
          sociedad: sociedad || null,
          fecha_compromiso_pago: fechaCompromisoPago ? fechaCompromisoPago.toString() : null,
          despachado,
          tipo_precio: tipoPrecio,
          vendedor_id: vendedorId,
          bultos,
        })
      } catch (err) {
        console.error('Auto-save error:', err)
      } finally {
        setAutoSaving(false)
        autoSavingRef.current = false
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [
    itemsPayload,
    tipoDocumento,
    fechaCreacionDate,
    fechaEntrega,
    observacion,
    transporte,
    sociedad,
    fechaCompromisoPago,
    despachado,
    pedidoId,
    vendedorId,
    tipoPrecio,
    bultos,
  ])


  // Precarga ÚNICA de todo el catálogo (una sola llamada), para buscar en memoria.
  useEffect(() => {
    let cancelled = false
    api.get('/productos', { params: { all: true } })
      .then((res) => { if (!cancelled) setTodosProductos(res.data.items) })
      .catch(() => { if (!cancelled) toast.error('Error al cargar productos') })
      .finally(() => { if (!cancelled) setLoadingTodos(false) })
    return () => { cancelled = true }
  }, [])

  // Filtrado client-side por nombre/código/categoría (instantáneo, sin API).
  const productosFiltrados = useMemo(() => {
    const q = debouncedProductSearch.trim().toLowerCase()
    if (!q) return todosProductos.slice(0, 50)
    const res = todosProductos.filter((p) =>
      `${p.nombre ?? ''} ${p.codigo ?? ''} ${p.categoria_producto ?? ''}`.toLowerCase().includes(q)
    )
    return res.slice(0, 50)
  }, [todosProductos, debouncedProductSearch])

  const importeTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.precio_total, 0),
    [items]
  )

  // Stock disponible EN LA UNIDAD pedida (cajas o blísters). Para blíster usa el
  // total de blísters disponibles (cajas*blisters_por_caja + sueltos), no el de cajas.
  const getAvailableStock = useCallback((producto: Producto, unidad: UnidadVenta = 'caja') => {
    const isSanalle = sociedad.toLowerCase() === 'sanalle' || tipoDocumento === 'factura'
    if (unidad === 'blister') {
      const total = isSanalle ? producto.total_blisters_a : producto.total_blisters_b
      if (total != null) return total
      const cajas = isSanalle ? producto.stock_a_cajas : producto.stock_b_cajas
      return cajas * (producto.blisters_por_caja || 1)
    }
    return isSanalle ? producto.stock_a_cajas : producto.stock_b_cajas
  }, [sociedad, tipoDocumento])

  const modalPrecioTotal = useMemo(
    () => modalCantidad * modalPrecio,
    [modalCantidad, modalPrecio]
  )

  const handleCantidadChange = (e: React.ChangeEvent<HTMLInputElement>, selectedProduct: Producto) => {
    const cantidad = Number(e.target.value)
    const disponible = getAvailableStock(selectedProduct, modalUnidad)
    if (cantidad > disponible) {
      const u = modalUnidad === 'blister' ? 'blísters' : 'cajas'
      toast.error(`No puedes pedir más de ${disponible} ${u}`)
      return
    }
    setModalCantidad(cantidad)
  }

  // Precio base de una línea según el tipo de precio actual (lista del grupo).
  const precioBase = useCallback(
    (item: PedidoItemLocal): number | null =>
      precioDeLista(item.producto_precios, tipoPrecio),
    [tipoPrecio]
  )

  // Un pedido minorista que supera los $800.000 pasa a mayorista.
  // Comercio NO se toca: es una lista propia, no un escalón por volumen.
  useEffect(() => {
    if (tipoPrecio === 'minorista' && importeTotal >= 800000) {
      setTipoPrecio('mayorista')
      toast.success('El pedido superó los $800.000. Se aplicó precio mayorista automáticamente.')
    }
  }, [importeTotal, tipoPrecio])

  // Al cambiar el tipo de precio, se reprecian todas las líneas contra la lista nueva.
  // Comparar contra el valor anterior (en vez de un flag de "ya montó") deja el efecto
  // idempotente: no repricea en el montaje —los ítems guardados ya traen su precio del
  // backend— ni se duplica con el doble render de StrictMode.
  const tipoPrecioPrevio = useRef(tipoPrecio)
  useEffect(() => {
    if (tipoPrecioPrevio.current === tipoPrecio) return
    tipoPrecioPrevio.current = tipoPrecio

    const sinPrecio: string[] = []
    const nextItems = itemsRef.current.map((item) => {
      const baseCaja = precioDeLista(item.producto_precios, tipoPrecio)
      if (baseCaja === null) {
        // Sin precio en la lista nueva: se conserva el precio actual (nunca 0) y se avisa.
        sinPrecio.push(item.producto_nombre)
        return item
      }

      // Respetar la unidad de la línea (el blíster deriva del precio de caja).
      const base = precioBasePorUnidad(baseCaja, item.unidad_venta, item.blisters_por_caja) ?? baseCaja

      const nuevoPrecioUnitario = item.descuento_porcentaje
        ? base * (1 - item.descuento_porcentaje / 100)
        : base

      return {
        ...item,
        precio_lista: item.descuento_porcentaje ? base : null,
        precio_unitario: nuevoPrecioUnitario,
        precio_total: item.cantidad * nuevoPrecioUnitario,
      }
    })

    setItems(nextItems)

    if (sinPrecio.length > 0) {
      toast.error(
        `Sin precio ${GRUPO_LABEL[tipoPrecio]}, se mantuvo el precio anterior: ${sinPrecio.join(', ')}`,
        { duration: 6000 }
      )
    }
  }, [tipoPrecio, precioBase])

  const openModal = () => {
    setProductSearch('')
    setSelectedProduct(null)
    setModalCantidad(1)
    setModalPrecio(0)
    setModalDescuento(0)
    setModalPrecioLista(0)
    setModalUnidad('caja')
    setModalOpen(true)
  }

  const selectProduct = (producto: Producto) => {
    const unidades = unidadesDeProducto(producto)
    const unidad = unidades[0]
    const precios = preciosDeProducto(producto)
    const baseCaja = precioDeLista(precios, tipoPrecio) ?? (esComercio ? 0 : producto.pvp ?? 0)
    const precioInicial = precioBasePorUnidad(baseCaja, unidad, producto.blisters_por_caja) ?? 0

    setSelectedProduct(producto)
    setModalUnidad(unidad)
    setModalPrecioLista(precioInicial)
    setModalPrecio(precioInicial)
    setModalDescuento(0)
    setModalCantidad(1)
  }

  // Cambio de unidad (caja/blister): reprecia la base según la unidad elegida.
  const handleUnidadChange = (unidad: UnidadVenta) => {
    if (!selectedProduct) return
    setModalUnidad(unidad)
    const precios = preciosDeProducto(selectedProduct)
    const baseCaja = precioDeLista(precios, tipoPrecio) ?? (esComercio ? 0 : selectedProduct.pvp ?? 0)
    const nuevaBase = precioBasePorUnidad(baseCaja, unidad, selectedProduct.blisters_por_caja) ?? 0
    setModalPrecioLista(nuevaBase)
    setModalPrecio(nuevaBase * (1 - modalDescuento / 100))
  }

  const handleDescuentoChange = (desc: number) => {
    setModalDescuento(desc)
    setModalPrecio(modalPrecioLista * (1 - desc / 100))
  }

  // keepOpen=true: agrega el ítem y vuelve al buscador para cargar otro (sin cerrar).
  const addItem = (keepOpen = false) => {
    if (!selectedProduct) return

    if (items.some((item) => item.producto_id === selectedProduct.id)) {
      toast.error(`${selectedProduct.nombre} ya está en el pedido`)
      return
    }
    if (esComercio && modalSinPreciosComercio) {
      toast.error(`${selectedProduct.nombre} no tiene precio de comercio`)
      return
    }
    if (modalCantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (modalPrecio < 0) {
      toast.error('El precio no puede ser negativo')
      return
    }

    const newItem: PedidoItemLocal = {
      producto_id: selectedProduct.id,
      producto_nombre: selectedProduct.nombre,
      presentacion: selectedProduct.presentacion,
      cantidad: modalCantidad,
      unidad_venta: modalUnidad,
      precio_lista: modalDescuento > 0 ? modalPrecioLista : null,
      descuento_porcentaje: modalDescuento > 0 ? modalDescuento : null,
      precio_unitario: modalPrecio,
      precio_total: modalCantidad * modalPrecio,
      producto_precios: preciosDeProducto(selectedProduct),
      blisters_por_caja: selectedProduct.blisters_por_caja,
    }

    setItems((prev) => [...prev, newItem])
    toast.success(`${selectedProduct.nombre} agregado`)

    if (keepOpen) {
      // Volver al buscador para seguir cargando, con foco en la búsqueda.
      setSelectedProduct(null)
      setProductSearch('')
      setModalCantidad(1)
      setModalPrecio(0)
      setModalDescuento(0)
      setModalPrecioLista(0)
      setModalUnidad('caja')
    } else {
      setModalOpen(false)
    }
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFinalize = async () => {
    if (items.length === 0) {
      toast.error('Debe agregar al menos un producto')
      return
    }

    setSaving(true)
    try {
      await api.put(`/pedidos/${pedidoId}`, {
        tipo_documento: tipoDocumento,
        items: itemsPayload,
        observacion: observacion || null,
        fecha: fechaCreacionDate ? fechaCreacionDate.toString() : null,
        fecha_entrega: fechaEntrega ? fechaEntrega.toString() : null,
        transporte: transporte || null,
        direccion_entrega: direccionEntrega || null,
        sociedad: sociedad || null,
        fecha_compromiso_pago: fechaCompromisoPago ? fechaCompromisoPago.toString() : null,
        despachado,
        tipo_precio: tipoPrecio,
        vendedor_id: vendedorId,
        bultos,
        estado: 'pedido',
      })
      toast.success('Pedido finalizado exitosamente')
      router.push('/dashboard/pedidos')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Error al finalizar el pedido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? `Editar Pedido - ${numeroPedido}` : `Nuevo Pedido - ${clienteNombre}`}
              </h1>
              {autoSaving && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Guardando...
                </span>
              )}
              {!autoSaving && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
                  <Save className="w-3 h-3" />
                  Guardado
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {isEditing ? `Cliente: ${clienteNombre}` : 'Crea un nuevo pedido para este cliente'}
            </p>
          </div>
        </div>
      </div>

      {/* Tipo Documento & Precio Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Tipo de Documento</h2>
          <RadioGroup
            value={tipoDocumento}
            onChange={(val: string) => setTipoDocumento(val as 'remito' | 'factura')}
            orientation="horizontal"
            className="flex gap-3"
            aria-label="Tipo de documento"
          >
            {(['remito', 'factura'] as const).map((tipo) => (
              <Radio
                key={tipo}
                value={tipo}
                className={({ isSelected }) =>
                  `flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors cursor-pointer capitalize outline-none focus-visible:ring-2 focus-visible:ring-[#003087]/50 ${isSelected
                    ? 'border-[#003087] bg-[#003087]/5 text-[#003087]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`
                }
              >
                {tipo}
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Tipo de Precio</h2>
            {clienteTipo && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-500 border border-gray-200">
                Cliente: {clienteTipo}
              </span>
            )}
          </div>
          <RadioGroup
            value={tipoPrecio}
            onChange={(val: string) => {
              if (esGrupo(val)) setTipoPrecio(val)
            }}
            orientation="horizontal"
            className="flex gap-3"
            aria-label="Tipo de precio"
          >
            {GRUPO_OPTIONS.map((tipo) => (
              <Radio
                key={tipo.value}
                value={tipo.value}
                className={({ isSelected }) =>
                  `flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 ${isSelected
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`
                }
              >
                {tipo.label}
              </Radio>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Order Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Datos del Pedido</h2>

        {/* Identidad / logística */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">N° Pedido</label>
            <input type="text" value={numeroPedido || ''} readOnly
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Vendedor</label>
            {isAdmin ? (
              <select value={vendedorId || ''} onChange={(e) => setVendedorId(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white">
                <option value="">Seleccione un vendedor</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre_completo || v.username}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={vendedorNombre || ''} readOnly
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide">
              <span className={!sociedad ? 'text-amber-600' : 'text-gray-500'}>Sociedad {!sociedad && '*'}</span>
            </label>
            <select value={sociedad} required onChange={(e) => setSociedad(e.target.value as 'sanalle' | 'farmacare' | '')}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] ${!sociedad ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`}>
              <option value="">Sin especificar</option>
              <option value="sanalle">Sanalle</option>
              <option value="farmacare">Farmacare</option>
            </select>
            {!sociedad && <p className="text-[11px] text-amber-600 mt-1">Elegí una sociedad para poder cargar productos</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Bultos</label>
            <input type="number" min={0} value={bultos} onChange={(e) => setBultos(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-gray-50">
          <div>
            <DatePicker value={fechaCreacionDate} onChange={setFechaCreacionDate}>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Creación</label>
              <DateInput className="flex gap-0.5 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#003087]/20 focus-within:border-[#003087] bg-white">
                {(segment) => (<DateSegmentInput segment={segment} className="rounded px-0.5 outline-none focus:bg-[#003087] focus:text-white data-[placeholder]:text-gray-400" />)}
              </DateInput>
            </DatePicker>
            {!isEditing && <p className="text-[11px] text-gray-400 mt-1">Por defecto: hoy</p>}
          </div>
          <div>
            <DatePicker value={fechaEntrega} onChange={setFechaEntrega}>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Entrega</label>
              <DateInput className="flex gap-0.5 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#003087]/20 focus-within:border-[#003087] bg-white">
                {(segment) => (<DateSegmentInput segment={segment} className="rounded px-0.5 outline-none focus:bg-[#003087] focus:text-white data-[placeholder]:text-gray-400" />)}
              </DateInput>
            </DatePicker>
            {!isEditing && (
              <p className="text-[11px] text-gray-400 mt-1">
                {diasEntregaCliente != null
                  ? `Cliente: ${diasEntregaCliente} ${diasEntregaCliente === 1 ? 'día' : 'días'}`
                  : 'Por defecto: mañana'}
              </p>
            )}
          </div>
          <div>
            <DatePicker value={fechaCompromisoPago} onChange={setFechaCompromisoPago}>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Compromiso de Pago</label>
              <DateInput className="flex gap-0.5 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#003087]/20 focus-within:border-[#003087] bg-white">
                {(segment) => (<DateSegmentInput segment={segment} className="rounded px-0.5 outline-none focus:bg-[#003087] focus:text-white data-[placeholder]:text-gray-400" />)}
              </DateInput>
            </DatePicker>
            {!isEditing && (
              <p className="text-[11px] text-gray-400 mt-1">
                {plazoCliente ? `Cliente: plazo ${plazoCliente} días` : 'Por defecto: mañana'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Transporte</label>
            <input type="text" value={transporte} onChange={(e) => setTransporte(e.target.value)} placeholder="OCA, propio..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
          </div>
        </div>

        {/* Envío — campos editables por pedido (precargados del cliente) */}
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Envío</span>
            {clienteDireccionDefault && direccionEntrega !== clienteDireccionDefault && (
              <button type="button" onClick={usarDireccionCliente} className="text-[11px] font-medium text-[#003087] hover:underline">
                Usar la del cliente
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Domicilio</label>
              <input type="text" value={envioDomicilio} onChange={(e) => onEnvioChange({ dom: e.target.value })} placeholder="Calle y número"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Localidad</label>
              <input type="text" value={envioLocalidad} onChange={(e) => onEnvioChange({ loc: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Cód. postal</label>
              <input type="text" value={envioCp} onChange={(e) => onEnvioChange({ cp: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Provincia</label>
              <input type="text" value={envioProvincia} onChange={(e) => onEnvioChange({ prov: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
            </div>
          </div>

          <div className="mt-2">
            <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Dirección de entrega (lo que se guarda)</label>
            <textarea
              value={direccionEntrega}
              onChange={(e) => setDireccionEntrega(e.target.value)}
              rows={2}
              placeholder="Se arma con los campos de arriba; podés ajustarla."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] resize-none bg-white"
            />
          </div>
          {!(clienteDomicilio || clienteLocalidad || clienteCodigoPostal || clienteProvincia) && (
            <p className="text-[11px] text-amber-600 mt-1">El cliente no tiene domicilio/localidad cargados. Cargalos en su ficha para autocompletar.</p>
          )}
        </div>

        {/* Observación + despachado */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-gray-50">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Observación</label>
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] resize-none"
              placeholder="Observaciones del pedido..." />
          </div>
          <div className="flex items-end pb-1.5">
            <label htmlFor="despachado" className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input id="despachado" type="checkbox" checked={despachado} onChange={(e) => setDespachado(e.target.checked)}
                className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20" />
              Despachado
            </label>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
            {items.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#003087]/10 text-[#003087]">{items.length}</span>
            )}
          </div>
          <button
            type="button"
            onClick={openModal}
            disabled={saving || !sociedad}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white bg-[#003087] hover:bg-[#002570] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            title={!sociedad ? 'Elegí la sociedad primero' : 'Agregar producto'}
          >
            <Plus className="w-4 h-4" />
            Agregar Producto
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#003087]/5 flex items-center justify-center mb-3">
              <Package className="w-7 h-7 text-[#003087]/40" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Todavía no agregaste productos</p>
            {!sociedad ? (
              <p className="text-xs mt-1 text-amber-600 font-medium">Elegí una sociedad arriba para poder cargar productos.</p>
            ) : (
              <p className="text-xs mt-1 text-gray-400">Tocá &quot;Agregar Producto&quot; y cargá varios de corrido con &quot;Agregar y seguir&quot;.</p>
            )}
            <button
              type="button"
              onClick={openModal}
              disabled={saving || !sociedad}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-[#003087] bg-[#003087]/10 hover:bg-[#003087]/20 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <Plus className="w-4 h-4" />
              Agregar el primero
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Presentación
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Desc %
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Precio Unit.
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Precio Total
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Quitar
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-700">{item.producto_nombre}</td>
                    <td className="px-4 py-2 text-gray-700">{item.presentacion || '-'}</td>
                    <td className="px-4 py-2 text-gray-700 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {item.cantidad}
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full border ${item.unidad_venta === 'blister' ? 'text-[#00AEEF] bg-[#00AEEF]/10 border-[#00AEEF]/30' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                          {item.unidad_venta === 'blister' ? 'Blíster' : 'Caja'}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.descuento_porcentaje
                        ? <span className="text-orange-600 font-medium">{item.descuento_porcentaje}%</span>
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-gray-700 text-right">
                      {formatCurrency(item.precio_unitario)}
                    </td>
                    <td className="px-4 py-2 text-gray-700 text-right font-semibold">
                      {formatCurrency(item.precio_total)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        title="Quitar producto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/60">
                  <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700">
                    Total:
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900">
                    {formatCurrency(importeTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Barra de acción fija: total siempre visible + finalizar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total del pedido</p>
            <p className="text-lg sm:text-xl font-black text-[#003087] leading-tight">
              {formatCurrency(importeTotal)}
              <span className="ml-2 text-xs font-medium text-gray-400">· {items.length} producto{items.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 sm:px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving || items.length === 0}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 text-sm font-semibold text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Finalizar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* Product Search Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Agregar Producto</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {!selectedProduct ? (
                <>
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre o código..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                      autoFocus
                    />
                  </div>

                  {/* Product list */}
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {loadingTodos ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#003087]" />
                      </div>
                    ) : productosFiltrados.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-8">
                        No se encontraron productos
                      </p>
                    ) : (
                      <>
                        {productosFiltrados.map((producto) => {
                          const precios = preciosDeProducto(producto)
                          // Precio de la lista actual; sin precio va "—", nunca $0.
                          const precioPreview = precioDeLista(precios, tipoPrecio)

                          return (
                            <button
                              key={producto.id}
                              type="button"
                              onClick={() => selectProduct(producto)}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {producto.nombre}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {producto.codigo}
                                    {producto.presentacion && ` | ${producto.presentacion}`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-semibold ${precioPreview === null ? 'text-gray-400' : 'text-gray-900'}`}>
                                    {precioPreview === null ? '—' : formatCurrency(precioPreview)}
                                  </p>
                                  {esComercio && precioPreview === null && (
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                      Sin precio comercio
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500">
                                    Disp:{' '}
                                    <span
                                      className={`font-bold ${getAvailableStock(producto) <= 0
                                        ? 'text-red-600'
                                        : 'text-green-600'
                                        }`}
                                    >
                                      {getAvailableStock(producto)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                        {productosFiltrados.length === 50 && (
                          <p className="text-center text-[11px] text-gray-400 py-2">
                            Mostrando los primeros 50. Afiná la búsqueda para ver más.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected product details */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        {selectedProduct.nombre}
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                        <div>
                          <span className="block text-gray-400">Presentación</span>
                          {selectedProduct.presentacion || '-'}
                        </div>
                        <div>
                          <span className="block text-gray-400">Categoría</span>
                          {selectedProduct.categoria_producto || '-'}
                        </div>
                        <div>
                          <span className="block text-gray-400">Stock Disponible</span>
                          <span className="font-bold text-gray-900">
                            {getAvailableStock(selectedProduct, modalUnidad)} {modalUnidad === 'blister' ? 'blísters' : 'cajas'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {esComercio && modalSinPreciosComercio && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <span className="font-semibold">{selectedProduct.nombre}</span> no tiene precio de comercio
                        cargado, así que no se puede agregar a un pedido de comercio.
                      </div>
                    )}

                    {/* Selector de unidad de venta (solo si el producto admite más de una) */}
                    {modalUnidades.length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de venta</label>
                        <div className="flex gap-2">
                          {modalUnidades.map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => handleUnidadChange(u)}
                              className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${modalUnidad === u ? 'border-[#003087] bg-[#003087]/5 text-[#003087]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                              {UNIDAD_LABEL[u]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          P. Lista
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={modalPrecioLista}
                          onChange={(e) => {
                            const lista = Number(e.target.value)
                            setModalPrecioLista(lista)
                            setModalPrecio(lista * (1 - modalDescuento / 100))
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Desc %
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={modalDescuento}
                          onChange={(e) => handleDescuentoChange(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Unitario
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={modalPrecio}
                        onChange={(e) => setModalPrecio(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad {modalUnidades.length > 1 ? `(en ${modalUnidad === 'blister' ? 'blísters' : 'cajas'})` : ''}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={modalCantidad}
                        max={getAvailableStock(selectedProduct, modalUnidad)}
                        onChange={(e) => handleCantidadChange(e, selectedProduct)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addItem(e.shiftKey) // Enter = agregar; Shift+Enter = agregar y seguir
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Total
                      </label>
                      <input
                        type="text"
                        value={formatCurrency(modalPrecioTotal)}
                        readOnly
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100">
              {selectedProduct ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => addItem(true)}
                    disabled={modalSinPreciosComercio}
                    className="px-4 py-2 text-sm font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Agrega y vuelve al buscador para cargar otro"
                  >
                    Agregar y seguir
                  </button>
                  <button
                    type="button"
                    onClick={() => addItem(false)}
                    disabled={modalSinPreciosComercio}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Agregar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
