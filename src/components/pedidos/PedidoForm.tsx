'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Search, ArrowLeft, Package, Loader2, Save, AlertTriangle, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { RadioGroup, Radio, DatePicker, DateInput, DateSegment as DateSegmentInput } from 'react-aria-components'
import { parseDate, today, getLocalTimeZone, type DateValue } from '@internationalized/date'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useConfiguracion } from '@/hooks/useConfiguracion'
import { AvisoStock, ClienteDireccion, Deposito, ModalidadEntrega, PedidoPlanPago, Producto, User } from '@/types'
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
  precioConDescuento,
  recalcularLinea,
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
  /** Depósito del que sale la línea. null = usa el depósito del pedido. */
  deposito_id?: number | null
  deposito_nombre?: string | null
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

/** Cuenta de dinero de la empresa, tal como la devuelve `GET /cuentas`. */
interface CuentaSimple {
  id: number
  nombre: string
  tipo: string
  es_default: boolean
  activo?: boolean
}

interface PedidoFormProps {
  pedidoId: number
  clienteId: number
  clienteNombre?: string
  clienteTipo?: string
  clienteCondicionPago?: string | null
  clientePlazoDias?: number | null
  clienteDiasEntrega?: number | null
  /** Datos de dirección del cliente (se muestran y arman el default del envío). */
  clienteDomicilio?: string | null
  clienteLocalidad?: string | null
  /** Para geocodificar una dirección nueva guardada desde acá. */
  clienteLocalidadId?: number | null
  clienteCodigoPostal?: string | null
  clienteProvincia?: string | null
  numeroPedido: string
  vendedorNombre?: string
  initialVendedorId?: number
  fechaCreacion?: string
  /** Fecha de creación en ISO (YYYY-MM-DD), editable. */
  initialFecha?: string | null

  initialTipoDocumento: 'remito' | 'factura'
  /** Solo lectura: la fecha la confirma depósito desde Preparación. */
  initialFechaEntrega: string | null
  initialObservacion: string
  initialTransporte?: string | null
  initialModalidadEntrega?: ModalidadEntrega | null
  /** Último transporte del cliente: se propone si el pedido no trae uno. */
  clienteTransporteHabitual?: string | null
  initialDireccionEntrega?: string | null
  /** Dirección de la libreta del cliente elegida para este pedido. */
  initialDireccionEntregaId?: number | null
  initialSociedad?: string | null
  initialFechaCompromisoPago?: string | null
  initialItems: PedidoItemLocal[]
  initialTipoPrecio?: Grupo | null
  /** Qué clase de venta es, independiente de la lista de precios usada. */
  initialTipoCliente?: Grupo | null
  /** False = este pedido no escala solo a mayorista aunque supere el umbral. */
  initialAplicaUmbralMayorista?: boolean
  /** Plan de cobro del pedido (informativo: no genera pagos). */
  initialPlanPago?: PedidoPlanPago[]
  /** False = el pedido no compromete mercadería (se factura antes del ingreso). */
  initialReservaStock?: boolean
  /** Estado del pedido. Solo un borrador se "finaliza"; el resto ya lo está. */
  shippingStatus?: string

  isEditing: boolean
  onCancel: () => void
}

export default function PedidoForm({
  pedidoId,
  clienteId,
  clienteNombre,
  clienteTipo,
  clienteCondicionPago,
  clientePlazoDias,
  clienteDiasEntrega,
  clienteDomicilio,
  clienteLocalidad,
  clienteLocalidadId,
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
  initialModalidadEntrega,
  clienteTransporteHabitual,
  initialDireccionEntrega,
  initialDireccionEntregaId,
  initialSociedad,
  initialFechaCompromisoPago,
  initialItems,
  initialTipoPrecio,
  initialTipoCliente,
  initialAplicaUmbralMayorista,
  initialPlanPago,
  initialReservaStock,
  shippingStatus,
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
  // La fecha de entrega la sugiere el backend al crear el pedido y la confirma
  // depósito. Acá solo se muestra: en el form de ventas es un dato, no un campo.
  const fechaEntregaSugerida = useMemo(() => {
    const iso = initialFechaEntrega ?? (isEditing ? null : entregaDefault.toString())
    if (!iso) return null
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }, [initialFechaEntrega, isEditing, entregaDefault])
  // Fecha de creación editable (default: hoy).
  const [fechaCreacionDate, setFechaCreacionDate] = useState<DateValue | null>(() => {
    if (initialFecha) {
      try { return parseDate(initialFecha) } catch { /* noop */ }
    }
    return hoy
  })
  const [observacion, setObservacion] = useState(initialObservacion)
  // Para llevar el foco al campo cuando falta el motivo de una excepción de precio.
  const observacionRef = useRef<HTMLTextAreaElement>(null)
  // El transporte arranca con el del pedido; si es nuevo, con el último que usó
  // el cliente. Sigue siendo editable y lo que se guarde vuelve a la ficha.
  const [transporte, setTransporte] = useState(initialTransporte || clienteTransporteHabitual || '')
  // Sugerencias del combo paramétrico de transportes (tabla `entidades`). El campo
  // sigue siendo texto libre: se puede escribir uno que no esté en la lista.
  const [transportesSugeridos, setTransportesSugeridos] = useState<string[]>([])
  // Retira por depósito o envío a domicilio. De esto dependen qué dirección sale
  // impresa en el remito y cuántas copias se emiten.
  const [modalidadEntrega, setModalidadEntrega] = useState<ModalidadEntrega>(initialModalidadEntrega || 'envio')
  const esRetiro = modalidadEntrega === 'retira'

  // Libreta de direcciones de entrega del cliente.
  const [direcciones, setDirecciones] = useState<ClienteDireccion[]>([])
  const [direccionEntregaId, setDireccionEntregaId] = useState<number | null>(
    initialDireccionEntregaId ?? null
  )
  const [etiquetaNueva, setEtiquetaNueva] = useState('')
  // Al guardar una dirección nueva desde el pedido, poder dejarla como la
  // principal del cliente sin tener que ir a su ficha.
  const [nuevaEsPrincipal, setNuevaEsPrincipal] = useState(false)

  // Plan de cobro: cómo se va a cobrar el pedido y a qué cuenta entra cada parte.
  // Es un dato para cobranza; no crea pagos ni mueve la cuenta corriente.
  const [planPago, setPlanPago] = useState<PedidoPlanPago[]>(initialPlanPago ?? [])
  const [cuentas, setCuentas] = useState<CuentaSimple[]>([])
  const [formasPago, setFormasPago] = useState<string[]>([])

  // Índice de la línea que el modal está editando. null = alta de una línea nueva.
  // Es lo que hace que el mismo modal sirva para agregar y para corregir, sin
  // duplicar la validación de stock, precio y depósito.
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [guardandoDireccion, setGuardandoDireccion] = useState(false)
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
  const [tipoPrecio, setTipoPrecio] = useState<Grupo>(() => {
    if (esGrupo(initialTipoPrecio)) return initialTipoPrecio
    if (esGrupo(clienteTipo)) return clienteTipo
    return 'minorista'
  })
  // Qué clase de venta es. Arranca igual que el tipo de precio pero NO lo sigue:
  // subir la lista a mayorista por volumen no convierte al cliente en mayorista.
  const [tipoCliente, setTipoCliente] = useState<Grupo>(() => {
    if (esGrupo(initialTipoCliente)) return initialTipoCliente
    if (esGrupo(clienteTipo)) return clienteTipo
    return 'minorista'
  })
  // Pedido que no compromete mercadería: se usa en operaciones de volumen que se
  // facturan antes de que entre el ingreso del proveedor. Mientras está apagado
  // el form no limita las cantidades por stock, porque la mercadería no entró.
  const [reservaStock, setReservaStock] = useState(initialReservaStock ?? true)
  // Umbral de escalón a mayorista, configurable en Configuración general.
  const umbralMayorista = useConfiguracion().numero('umbral_mayorista')
  // Excepción por pedido: no escalar aunque supere el umbral. Va auditado.
  const [aplicaUmbral, setAplicaUmbral] = useState(initialAplicaUmbralMayorista ?? true)
  // Líneas que piden más de lo disponible. En una cotización es un aviso, no un
  // bloqueo: el backend lo recalcula en cada guardado y lo devuelve acá.
  const [avisosStock, setAvisosStock] = useState<AvisoStock[]>([])
  // Alguna línea salió a un precio distinto del de lista. Lo decide el backend
  // recalculando contra la lista real: acá no se puede, porque cuando el vendedor
  // pisa el precio a mano el form conserva el `precio_lista` viejo de referencia.
  const [excepcionPrecio, setExcepcionPrecio] = useState<{ hay: boolean; detalle: string | null }>({
    hay: false,
    detalle: null,
  })
  const [items, setItems] = useState<PedidoItemLocal[]>(initialItems)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const esComercio = tipoPrecio === 'comercio'
  // Depósito del pedido: de dónde sale la mercadería. Es independiente de la
  // sociedad (que ahora es solo facturación) y cada línea puede pisarlo si en
  // ese depósito no hay stock.
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [depositoId, setDepositoId] = useState<number | null>(
    initialItems.find((i) => i.deposito_id)?.deposito_id ?? null
  )
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
  // Depósito de la línea que se está agregando. Arranca en el del pedido y solo
  // se cambia si ahí no hay stock.
  const [modalDeposito, setModalDeposito] = useState<number | null>(null)

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

  // Depósitos disponibles para vender. El primero activo queda preseleccionado
  // en un pedido nuevo; en uno existente manda el que ya tienen sus líneas.
  useEffect(() => {
    api.get<Deposito[]>('/depositos')
      .then((res) => {
        const activos = (res.data ?? []).filter((d) => d.activo)
        setDepositos(activos)
        setDepositoId((prev) => prev ?? activos[0]?.id ?? null)
      })
      .catch(() => toast.error('Error al cargar depósitos'))
  }, [])

  // Fetch sellers if admin
  useEffect(() => {
    if (isAdmin) {
      api.get<User[]>('/users/vendedores')
        .then(res => setVendedores(res.data))
        .catch(err => console.error('Error fetching sellers:', err))
    }
  }, [isAdmin])

  useEffect(() => {
    api.get<{ items: { nombre: string }[] }>('/entidades', {
      params: { categoria: 'transporte', solo_activos: true },
    })
      .then((res) => setTransportesSugeridos(res.data.items.map((e) => e.nombre)))
      .catch(() => { /* el campo sigue siendo texto libre: sin sugerencias se puede tipear */ })

    api.get<{ items: { nombre: string }[] }>('/entidades', {
      params: { categoria: 'condicion_pago', solo_activos: true },
    })
      .then((res) => setFormasPago(res.data.items.map((e) => e.nombre)))
      .catch(() => { /* idem */ })

    api.get<CuentaSimple[]>('/cuentas')
      .then((res) => setCuentas(res.data.filter((c) => c.activo !== false)))
      .catch(() => { /* sin cuentas el plan igual se puede cargar, solo sin destino */ })
  }, [])

  // --- Plan de cobro ---------------------------------------------------------

  const totalPlanPago = useMemo(
    () => planPago.reduce((suma, t) => suma + (Number(t.importe) || 0), 0),
    [planPago]
  )

  const agregarTramoPago = () =>
    setPlanPago((prev) => [
      ...prev,
      {
        forma: formasPago[0] ?? 'Contado',
        cuenta_id: cuentas.find((c) => c.es_default)?.id ?? null,
        // El primer tramo arranca con el total del pedido: el caso más común es
        // uno solo, y así no hay que tipear el importe.
        importe: prev.length === 0 ? importeTotal : 0,
      },
    ])

  const cambiarTramoPago = (idx: number, patch: Partial<PedidoPlanPago>) =>
    setPlanPago((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))

  const quitarTramoPago = (idx: number) =>
    setPlanPago((prev) => prev.filter((_, i) => i !== idx))

  useEffect(() => {
    if (!clienteId) return
    api.get<ClienteDireccion[]>(`/clientes/${clienteId}/direcciones`)
      .then((res) => {
        setDirecciones(res.data)
        // Pedido nuevo sin dirección elegida: se propone la marcada por defecto.
        setDireccionEntregaId((actual) => {
          if (actual !== null) return actual
          if (initialDireccionEntrega) return null  // el pedido ya trae una escrita a mano
          const porDefecto = res.data.find((d) => d.es_default) ?? res.data[0]
          if (porDefecto) setDireccionEntrega(porDefecto.direccion)
          return porDefecto?.id ?? null
        })
      })
      .catch(() => toast.error('No se pudieron cargar las direcciones del cliente'))
  }, [clienteId, initialDireccionEntrega])

  const elegirDireccion = (valor: string) => {
    if (valor === 'otra') {
      setDireccionEntregaId(null)
      return
    }
    const id = Number(valor)
    const elegida = direcciones.find((d) => d.id === id)
    if (!elegida) return
    setDireccionEntregaId(id)
    setDireccionEntrega(elegida.direccion)
  }

  // Guardar la dirección tipeada a mano en la libreta del cliente, para no
  // volver a escribirla en el próximo pedido.
  const guardarDireccionEnCliente = async () => {
    const texto = direccionEntrega.trim()
    if (!texto) {
      toast.error('Escribí la dirección antes de guardarla')
      return
    }
    setGuardandoDireccion(true)
    try {
      const res = await api.post<ClienteDireccion>(`/clientes/${clienteId}/direcciones`, {
        etiqueta: etiquetaNueva.trim() || 'Entrega',
        direccion: texto,
        // Sin localidad el backend no puede geocodificar y la entrega no aparece
        // en el mapa de reparto. Se hereda la del cliente, que es la correcta en
        // la enorme mayoría de los casos; si no lo es, se corrige en su ficha.
        localidad_id: clienteLocalidadId ?? null,
        codigo_postal: envioCp.trim() || null,
        // La primera siempre es la principal; el resto, sólo si lo piden.
        es_default: nuevaEsPrincipal || direcciones.length === 0,
      })
      // Si quedó como principal, las demás dejaron de serlo en el backend.
      setDirecciones((prev) =>
        (res.data.es_default ? prev.map((d) => ({ ...d, es_default: false })) : prev).concat(res.data)
      )
      setDireccionEntregaId(res.data.id)
      setEtiquetaNueva('')
      setNuevaEsPrincipal(false)
      toast.success(
        res.data.es_default
          ? 'Dirección guardada como principal del cliente'
          : 'Dirección guardada en la ficha del cliente'
      )
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'No se pudo guardar la dirección')
    } finally {
      setGuardandoDireccion(false)
    }
  }

  // Payload de ítems: única fuente de verdad para autosave y para finalizar.
  const itemsPayload = useMemo(
    () =>
      items.map((item) => ({
        producto_id: item.producto_id,
        deposito_id: item.deposito_id ?? depositoId,
        cantidad: item.cantidad,
        unidad_venta: item.unidad_venta,
        precio_lista: item.precio_lista,
        descuento_porcentaje: item.descuento_porcentaje,
        precio_unitario: item.precio_unitario,
        precio_total: item.precio_total,
      })),
    [items, depositoId]
  )

  // El catálogo se precarga una sola vez, así que el stock que ve el form
  // envejece a medida que se carga el pedido: cada línea que se guarda mueve
  // físico a reservado en el server. Con las cantidades editables en la grilla
  // eso se nota enseguida, así que después de cada guardado se refresca el stock
  // de los productos que están en el pedido.
  const refrescarStockDeItems = useCallback(async () => {
    const ids = Array.from(new Set(itemsRef.current.map((i) => i.producto_id)))
    if (ids.length === 0) return
    try {
      const frescos = await Promise.all(
        ids.map((id) => api.get<Producto>(`/productos/${id}`).then((r) => r.data))
      )
      const porId = new Map(frescos.map((p) => [p.id, p]))
      setTodosProductos((prev) => prev.map((p) => porId.get(p.id) ?? p))
    } catch {
      // Si falla, se sigue con el stock que ya estaba: el server igual valida
      // cada reserva, así que lo peor que pasa es un aviso tardío.
    }
  }, [])

  // Robust Auto-save logic (Debounced and duplicate-protected)
  const previousData = useRef<string | null>(null)

  useEffect(() => {
    const currentDataString = JSON.stringify({
      items: itemsPayload,
      tipoDocumento,
      fecha: fechaCreacionDate ? fechaCreacionDate.toString() : null,
      observacion: observacion || null,
      transporte: transporte || null,
      modalidadEntrega,
      direccionEntrega: direccionEntrega || null,
      direccionEntregaId,
      sociedad: sociedad || null,
      deposito_id: depositoId,
      fechaCompromisoPago: fechaCompromisoPago ? fechaCompromisoPago.toString() : null,
      tipo_precio: tipoPrecio,
      tipo_cliente: tipoCliente,
      aplica_umbral_mayorista: aplicaUmbral,
      vendedor_id: vendedorId,
      reserva_stock: reservaStock,
      plan_pago: planPago,
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
        const res = await api.put(`/pedidos/${pedidoId}`, {
          tipo_documento: tipoDocumento,
          items: itemsPayload,
          observacion: observacion || null,
          fecha: fechaCreacionDate ? fechaCreacionDate.toString() : null,
          transporte: transporte || null,
          modalidad_entrega: modalidadEntrega,
          direccion_entrega: direccionEntrega || null,
          direccion_entrega_id: direccionEntregaId,
          sociedad: sociedad || null,
          deposito_id: depositoId,
          fecha_compromiso_pago: fechaCompromisoPago ? fechaCompromisoPago.toString() : null,
          tipo_precio: tipoPrecio,
          tipo_cliente: tipoCliente,
          aplica_umbral_mayorista: aplicaUmbral,
          vendedor_id: vendedorId,
          reserva_stock: reservaStock,
          plan_pago: planPago,
        })
        // El backend recalcula el faltante contra el stock real en cada guardado:
        // es la única fuente confiable, porque el catálogo en memoria del form
        // puede estar desactualizado si otro vendedor se llevó la mercadería.
        setAvisosStock(res.data?.avisos_stock ?? [])
        setExcepcionPrecio({
          hay: Boolean(res.data?.tiene_excepcion_precio),
          detalle: res.data?.excepcion_precio_detalle ?? null,
        })
        await refrescarStockDeItems()
      } catch (err) {
        console.error('Auto-save error:', err)
        // Prender "descuenta stock" sobre mercadería que no alcanza vuelve 400.
        // Sin esto el rechazo pasaba en silencio y el form quedaba mostrando un
        // estado que la base nunca aceptó.
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        if (typeof detail === 'string') toast.error(detail)
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
    observacion,
    transporte,
    modalidadEntrega,
    direccionEntrega,
    direccionEntregaId,
    sociedad,
    depositoId,
    fechaCompromisoPago,
    pedidoId,
    vendedorId,
    tipoPrecio,
    tipoCliente,
    aplicaUmbral,
    reservaStock,
    planPago,
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

  // Stock disponible EN LA UNIDAD pedida (cajas o blísters), en el depósito del
  // que sale la línea. Antes esto miraba la sociedad, que es justamente lo que
  // hacía aparecer 0 cuando el stock estaba cargado en otro depósito.
  const stockEnDeposito = useCallback(
    (producto: Producto, deposito: number | null) =>
      producto.stocks?.find((st) => st.deposito_id === deposito) ?? null,
    []
  )

  const getAvailableStock = useCallback(
    (producto: Producto, unidad: UnidadVenta = 'caja', deposito: number | null = depositoId) => {
      const st = stockEnDeposito(producto, deposito)
      if (!st) return 0
      if (unidad === 'blister') return st.total_blisters
      return st.cajas
    },
    [depositoId, stockEnDeposito]
  )

  // ¿Este pedido tiene mercadería comprometida AHORA? Una cotización (borrador)
  // no reserva: la reserva se hace al confirmarla. El backend manda el dato en
  // `reserva_vigente`; acá se deriva del estado por si la respuesta es vieja.
  const reservaVigente = reservaStock && shippingStatus !== 'borrador'

  // El tope por stock solo aplica cuando el pedido ya reserva. Un pedido marcado
  // para no descontar vende mercadería que todavía no entró, y una cotización se
  // arma antes de tener el stock: en los dos casos el disponible se sigue
  // mostrando (depósito lo necesita) pero no bloquea la carga.
  const limitaPorStock = reservaVigente

  // Depósitos donde este producto sí tiene stock, para poder sugerir el cambio
  // en vez de dejar al vendedor frenado con un "no hay".
  const depositosConStock = useCallback(
    (producto: Producto, unidad: UnidadVenta) =>
      depositos.filter((d) => getAvailableStock(producto, unidad, d.id) > 0),
    [depositos, getAvailableStock]
  )

  // Depósito efectivo de la línea en curso: el elegido en el modal, o el del pedido.
  const modalDepositoEfectivo = modalDeposito ?? depositoId

  // Para cargar productos hacen falta las dos cosas: la sociedad define cómo se
  // factura y el depósito de dónde sale el stock que se va a validar.
  const faltaParaCargar = !sociedad ? 'sociedad' : !depositoId ? 'depósito' : null

  // ¿El pedido sale de más de un depósito? Solo entonces vale la pena mostrar
  // la columna por línea.
  const hayDepositosMixtos = useMemo(
    () => new Set(items.map((i) => i.deposito_id ?? depositoId)).size > 1,
    [items, depositoId]
  )

  // Stock que una línea puede tomar. Al editar hay que sumarle lo que esa misma
  // línea ya tiene reservado en el server: el disponible que ve el form ya lo
  // tiene descontado, así que sin esto subir de 10 a 11 se bloquearía cuando esa
  // línea se llevó el último stock.
  //
  // La compensación SOLO vale si la línea realmente reservó. En una cotización
  // no reservó nada, y sumarla inflaría el disponible al doble.
  const disponibleParaLinea = useCallback(
    (producto: Producto, unidad: UnidadVenta, deposito: number | null, idx: number | null) => {
      const base = getAvailableStock(producto, unidad, deposito)
      if (idx === null || !reservaVigente) return base
      const original = items[idx]
      if (!original || original.producto_id !== producto.id) return base
      if (original.unidad_venta !== unidad) return base
      if ((original.deposito_id ?? depositoId) !== deposito) return base
      return base + original.cantidad
    },
    [getAvailableStock, items, depositoId, reservaVigente]
  )

  // Sin stock suficiente para lo que se está tratando de agregar: bloquea el alta.
  const modalStockInsuficiente =
    limitaPorStock &&
    selectedProduct !== null &&
    modalCantidad > disponibleParaLinea(selectedProduct, modalUnidad, modalDepositoEfectivo, editandoIdx)

  // Otros depósitos donde sí hay, para ofrecer el cambio en el propio modal.
  const modalAlternativas = useMemo(
    () =>
      selectedProduct
        ? depositosConStock(selectedProduct, modalUnidad).filter((d) => d.id !== modalDepositoEfectivo)
        : [],
    [selectedProduct, modalUnidad, modalDepositoEfectivo, depositosConStock]
  )

  const modalPrecioTotal = useMemo(
    () => modalCantidad * modalPrecio,
    [modalCantidad, modalPrecio]
  )

  const handleCantidadChange = (e: React.ChangeEvent<HTMLInputElement>, selectedProduct: Producto) => {
    const cantidad = Number(e.target.value)
    const disponible = disponibleParaLinea(selectedProduct, modalUnidad, modalDepositoEfectivo, editandoIdx)
    if (limitaPorStock && cantidad > disponible) {
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

  // Un pedido minorista que supera el umbral pasa a mayorista.
  // Comercio NO se toca: es una lista propia, no un escalón por volumen.
  // El umbral sale de Configuración general (0 = desactivado) y el pedido puede
  // quedar exceptuado con `aplicaUmbral`.
  useEffect(() => {
    if (!aplicaUmbral || !(umbralMayorista > 0)) return
    if (tipoPrecio === 'minorista' && importeTotal >= umbralMayorista) {
      setTipoPrecio('mayorista')
      toast.success(
        `El pedido superó los ${formatCurrency(umbralMayorista)}. Se aplicó precio mayorista automáticamente.`
      )
    }
  }, [importeTotal, tipoPrecio, umbralMayorista, aplicaUmbral])

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
    setEditandoIdx(null)
    setProductSearch('')
    setSelectedProduct(null)
    setModalCantidad(1)
    setModalPrecio(0)
    setModalDescuento(0)
    setModalPrecioLista(0)
    setModalUnidad('caja')
    setModalOpen(true)
  }

  /** Abre el modal con una línea ya cargada, para cambiarle producto,
   *  depósito o unidad. Los datos "de plata" también se editan en la grilla. */
  const abrirEdicionLinea = (idx: number) => {
    const linea = items[idx]
    const producto = todosProductos.find((p) => p.id === linea.producto_id)
    if (!producto) {
      toast.error('No se encontró el producto de esa línea en el catálogo')
      return
    }
    setEditandoIdx(idx)
    setSelectedProduct(producto)
    setModalUnidad(linea.unidad_venta)
    setModalPrecioLista(linea.precio_lista ?? linea.precio_unitario)
    setModalPrecio(linea.precio_unitario)
    setModalDescuento(linea.descuento_porcentaje ?? 0)
    setModalCantidad(linea.cantidad)
    setModalDeposito(linea.deposito_id ?? null)
    setProductSearch('')
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

  // keepOpen=true: guarda y vuelve al buscador para cargar otro (sin cerrar).
  // Sirve tanto para el alta como para la edición: `editandoIdx` decide si la
  // línea se agrega al final o reemplaza a la que se estaba corrigiendo.
  const addItem = (keepOpen = false) => {
    if (!selectedProduct) return

    // Al editar, que la línea "duplique" su propio producto es lo normal.
    if (items.some((item, i) => item.producto_id === selectedProduct.id && i !== editandoIdx)) {
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
    const depLinea = modalDeposito ?? depositoId
    if (!depLinea) {
      toast.error('Elegí el depósito del que sale la mercadería')
      return
    }
    const disponible = disponibleParaLinea(selectedProduct, modalUnidad, depLinea, editandoIdx)
    if (limitaPorStock && modalCantidad > disponible) {
      const u = modalUnidad === 'blister' ? 'blísters' : 'cajas'
      const depNombre = depositos.find((d) => d.id === depLinea)?.nombre ?? 'el depósito'
      const alternativas = depositosConStock(selectedProduct, modalUnidad).filter((d) => d.id !== depLinea)
      const sugerencia = alternativas.length
        ? ` Hay stock en: ${alternativas.map((d) => d.nombre).join(', ')}.`
        : ''
      toast.error(
        `No hay stock suficiente de ${selectedProduct.nombre} en ${depNombre}: disponible ${disponible} ${u}.${sugerencia}`
      )
      return
    }

    const newItem: PedidoItemLocal = {
      producto_id: selectedProduct.id,
      producto_nombre: selectedProduct.nombre,
      presentacion: selectedProduct.presentacion,
      deposito_id: depLinea,
      deposito_nombre: depositos.find((d) => d.id === depLinea)?.nombre ?? null,
      cantidad: modalCantidad,
      unidad_venta: modalUnidad,
      precio_lista: modalDescuento > 0 ? modalPrecioLista : null,
      descuento_porcentaje: modalDescuento > 0 ? modalDescuento : null,
      precio_unitario: modalPrecio,
      precio_total: modalCantidad * modalPrecio,
      producto_precios: preciosDeProducto(selectedProduct),
      blisters_por_caja: selectedProduct.blisters_por_caja,
    }

    if (editandoIdx !== null) {
      const idx = editandoIdx
      setItems((prev) => prev.map((item, i) => (i === idx ? newItem : item)))
      toast.success(`${selectedProduct.nombre} actualizado`)
      setEditandoIdx(null)
      setModalOpen(false)
      return
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
      setModalDeposito(null)
    } else {
      setModalOpen(false)
    }
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  /** Edición directa en la grilla: cantidad, descuento y precio unitario.
   *  Usa la misma cuenta que el modal (`recalcularLinea`) para que no puedan
   *  dar números distintos. El autosave persiste solo, como con cualquier
   *  otro cambio del pedido. */
  const editarLinea = (
    idx: number,
    patch: Partial<Pick<PedidoItemLocal, 'cantidad' | 'descuento_porcentaje' | 'precio_unitario'>>,
  ) => {
    setItems((prev) =>
      prev.map((linea, i) => {
        if (i !== idx) return linea

        const cantidad = patch.cantidad ?? linea.cantidad
        const descuento = patch.descuento_porcentaje !== undefined
          ? patch.descuento_porcentaje
          : linea.descuento_porcentaje
        const base = linea.precio_lista ?? linea.precio_unitario

        // Tocar el descuento reprecia desde la lista; tocar el precio a mano lo
        // fija y el descuento queda solo como referencia de dónde salió.
        const unitario = patch.precio_unitario !== undefined
          ? patch.precio_unitario
          : patch.descuento_porcentaje !== undefined
            ? precioConDescuento(base, descuento ?? 0)
            : linea.precio_unitario

        const { precioUnitario, precioTotal } = recalcularLinea({
          precioLista: linea.precio_lista,
          descuento: descuento,
          precioUnitario: unitario,
          cantidad,
        })

        return {
          ...linea,
          cantidad,
          descuento_porcentaje: descuento,
          // Sin precio de lista guardado, el descuento no tiene contra qué
          // aplicarse: se guarda el unitario actual como base.
          precio_lista: linea.precio_lista ?? (descuento ? linea.precio_unitario : null),
          precio_unitario: precioUnitario,
          precio_total: precioTotal,
        }
      })
    )
  }

  /** Cantidad máxima que admite una línea ya cargada, para el input de la grilla. */
  const topeDeLinea = (linea: PedidoItemLocal, idx: number): number | undefined => {
    if (!limitaPorStock) return undefined
    const producto = todosProductos.find((p) => p.id === linea.producto_id)
    if (!producto) return undefined
    return disponibleParaLinea(producto, linea.unidad_venta, linea.deposito_id ?? depositoId, idx)
  }

  const handleFinalize = async () => {
    if (items.length === 0) {
      toast.error('Debe agregar al menos un producto')
      return
    }
    if (!depositoId) {
      toast.error('Elegí el depósito del que sale el pedido')
      return
    }
    // Espejo del control del backend, para avisar antes del round-trip. El
    // control real está allá: acá sólo evita el viaje y lleva el foco al campo.
    if (shippingStatus === 'borrador' && excepcionPrecio.hay && !observacion.trim()) {
      toast.error('El pedido tiene precios fuera de lista: cargá una observación explicando la excepción.')
      observacionRef.current?.focus()
      observacionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSaving(true)
    try {
      await api.put(`/pedidos/${pedidoId}`, {
        tipo_documento: tipoDocumento,
        items: itemsPayload,
        observacion: observacion || null,
        fecha: fechaCreacionDate ? fechaCreacionDate.toString() : null,
        transporte: transporte || null,
        modalidad_entrega: modalidadEntrega,
        direccion_entrega: direccionEntrega || null,
        direccion_entrega_id: direccionEntregaId,
        sociedad: sociedad || null,
        deposito_id: depositoId,
        fecha_compromiso_pago: fechaCompromisoPago ? fechaCompromisoPago.toString() : null,
        tipo_precio: tipoPrecio,
        tipo_cliente: tipoCliente,
        aplica_umbral_mayorista: aplicaUmbral,
        vendedor_id: vendedorId,
        reserva_stock: reservaStock,
        plan_pago: planPago,
      })
      // Finalizar es lo que saca al pedido de borrador y lo pone en la cola de
      // depósito. Un pedido que ya se finalizó antes se guarda y listo: volver a
      // moverlo de estado sería un error de transición.
      if (shippingStatus === 'borrador') {
        await api.patch(`/pedidos/${pedidoId}/shipping-status`, { shipping_status: 'pendiente' })
      }
      toast.success('Pedido finalizado exitosamente')
      router.push('/dashboard/pedidos')
    } catch (err: unknown) {
      // El PUT y el PATCH son dos pasos: si el que falló es el segundo (la
      // confirmación, típicamente por falta de stock) los cambios YA quedaron
      // guardados y el pedido sigue siendo una cotización. Decirlo así evita que
      // el vendedor crea que perdió lo que acaba de cargar.
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const motivo = typeof detail === 'string' ? detail : 'Error al finalizar el pedido'
      toast.error(
        shippingStatus === 'borrador'
          ? `La cotización se guardó, pero no se pudo confirmar: ${motivo}`
          : motivo
      )
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
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

          {/* Va aparte del precio a propósito: se puede vender a un minorista con
              precio mayorista por volumen, y para las estadísticas lo que importa
              es qué clase de cliente compró, no qué columna se usó. */}
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Tipo de Cliente</h2>
            <RadioGroup
              value={tipoCliente}
              onChange={(val: string) => {
                if (esGrupo(val)) setTipoCliente(val)
              }}
              orientation="horizontal"
              className="flex gap-3"
              aria-label="Tipo de cliente"
            >
              {GRUPO_OPTIONS.map((tipo) => (
                <Radio
                  key={tipo.value}
                  value={tipo.value}
                  className={({ isSelected }) =>
                    `flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 ${isSelected
                      ? 'border-slate-700 bg-slate-50 text-slate-800'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`
                  }
                >
                  {tipo.label}
                </Radio>
              ))}
            </RadioGroup>
            {tipoCliente !== tipoPrecio && (
              <p className="mt-2 text-xs text-amber-700">
                Precio {GRUPO_LABEL[tipoPrecio].toLowerCase()} sobre cliente {GRUPO_LABEL[tipoCliente].toLowerCase()}.
              </p>
            )}
          </div>

          {umbralMayorista > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!aplicaUmbral}
                  onChange={(e) => setAplicaUmbral(!e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#003087] focus:ring-[#003087]/40"
                />
                <span className="text-sm text-gray-700">
                  No escalar a mayorista automáticamente en este pedido
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Por defecto, un pedido minorista que supera {formatCurrency(umbralMayorista)} pasa a
                    precio mayorista. Tildar acá lo deja en la lista elegida.
                  </span>
                </span>
              </label>
            </div>
          )}
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
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide">
              <span className={!depositoId ? 'text-amber-600' : 'text-gray-500'}>Depósito {!depositoId && '*'}</span>
            </label>
            <select
              value={depositoId ?? ''}
              required
              onChange={(e) => setDepositoId(e.target.value ? Number(e.target.value) : null)}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] ${!depositoId ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`}
            >
              <option value="">Sin especificar</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">De dónde sale la mercadería</p>
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
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Entrega (sugerida)</label>
            <div className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
              {fechaEntregaSugerida ?? 'A definir'}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {diasEntregaCliente != null
                ? `Cliente: ${diasEntregaCliente} ${diasEntregaCliente === 1 ? 'día' : 'días'}. La confirma depósito.`
                : 'La confirma depósito al armar el pedido.'}
            </p>
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
            <input type="text" list="transportes-sugeridos" value={transporte} disabled={esRetiro}
              onChange={(e) => setTransporte(e.target.value)} placeholder="OCA, propio..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-100 disabled:text-gray-400" />
            <datalist id="transportes-sugeridos">
              {transportesSugeridos.map((t) => <option key={t} value={t} />)}
            </datalist>
            {esRetiro ? (
              <p className="text-[11px] text-gray-400 mt-1">No aplica: retira por depósito</p>
            ) : clienteTransporteHabitual && transporte === clienteTransporteHabitual && (
              <p className="text-[11px] text-gray-400 mt-1">El último que usó este cliente</p>
            )}
          </div>
        </div>

        {/* Modalidad de entrega — define qué remito se imprime y cuántas copias */}
        <div className="mt-4">
          <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Modalidad de entrega</span>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {([['envio', 'Envío a domicilio'], ['retira', 'Retira por depósito']] as const).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setModalidadEntrega(valor)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  modalidadEntrega === valor ? 'bg-[#003087] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {esRetiro
              ? 'El remito sale en una copia, con el depósito y sin dirección de entrega.'
              : 'El remito sale en tres copias (original, duplicado y triplicado) para el transporte.'}
          </p>
        </div>

        {esRetiro ? (
          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
            <p className="text-xs text-gray-500">
              Retira por depósito: no se carga dirección de entrega. Si el pedido ya tenía una, se conserva por si vuelve a ser un envío.
            </p>
          </div>
        ) : (
        /* Envío — se elige de la libreta del cliente, o se escribe una suelta */
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Dirección de entrega</span>
            {clienteDireccionDefault && direccionEntregaId === null && direccionEntrega !== clienteDireccionDefault && (
              <button type="button" onClick={usarDireccionCliente} className="text-[11px] font-medium text-[#003087] hover:underline">
                Usar la del cliente
              </button>
            )}
          </div>

          <select
            value={direccionEntregaId ?? 'otra'}
            onChange={(e) => elegirDireccion(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
          >
            {direcciones.map((d) => (
              <option key={d.id} value={d.id}>
                {d.es_default ? '★ ' : ''}{d.etiqueta}: {d.direccion}
                {d.localidad_nombre ? ` (${d.localidad_nombre})` : ''}
              </option>
            ))}
            <option value="otra">Otra dirección…</option>
          </select>
          {direcciones.length > 1 && (
            <p className="text-[11px] text-gray-400 mt-1">
              {direcciones.length} direcciones cargadas. ★ es la principal.
            </p>
          )}

          {direccionEntregaId === null && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
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

              {/* Guardarla en la ficha evita retipearla en el próximo pedido */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={etiquetaNueva}
                  onChange={(e) => setEtiquetaNueva(e.target.value)}
                  placeholder="Nombre (ej: Sucursal Centro)"
                  className="flex-1 min-w-[160px] px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
                <button
                  type="button"
                  onClick={guardarDireccionEnCliente}
                  disabled={guardandoDireccion || !direccionEntrega.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-[#003087] bg-[#003087]/10 hover:bg-[#003087]/20 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {guardandoDireccion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Guardar para este cliente
                </button>
                {direcciones.length > 0 && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nuevaEsPrincipal}
                      onChange={(e) => setNuevaEsPrincipal(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#003087] focus:ring-[#003087]/40"
                    />
                    <span className="text-[11px] text-gray-600">Dejarla como principal</span>
                  </label>
                )}
              </div>
            </>
          )}

          {!(clienteDomicilio || clienteLocalidad || clienteCodigoPostal || clienteProvincia) && direcciones.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">El cliente no tiene domicilio/localidad cargados. Cargalos en su ficha para autocompletar.</p>
          )}
        </div>
        )}

        {/* Observación */}
        <div className="mt-4 pt-4 border-t border-gray-50">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Observación
            {excepcionPrecio.hay && <span className="ml-1 text-amber-600 normal-case">(obligatoria)</span>}
          </label>
          <textarea ref={observacionRef} value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none ${
              excepcionPrecio.hay && !observacion.trim()
                ? 'border-amber-400 focus:ring-amber-400/30 focus:border-amber-500'
                : 'border-gray-300 focus:ring-[#003087]/20 focus:border-[#003087]'
            }`}
            placeholder={excepcionPrecio.hay ? 'Explicá la excepción de precio...' : 'Observaciones del pedido...'} />
          {excepcionPrecio.hay && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                Hay precios fuera de lista{excepcionPrecio.detalle ? ` — ${excepcionPrecio.detalle}` : ''}.
                Cargá el motivo antes de confirmar el pedido.
              </span>
            </p>
          )}
        </div>

        {/* Pedido que no compromete mercadería */}
        <div className="mt-4 pt-4 border-t border-gray-50">
          <label htmlFor="reserva_stock" className="inline-flex items-start gap-2.5 cursor-pointer">
            <input
              id="reserva_stock"
              type="checkbox"
              checked={!reservaStock}
              onChange={(e) => setReservaStock(!e.target.checked)}
              className="mt-0.5 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500/20"
            />
            <span>
              <span className="block text-sm font-medium text-gray-700">Este pedido no descuenta stock</span>
              <span className="block text-xs text-gray-500">
                Para operaciones de volumen que se facturan antes de que entre la mercadería.
              </span>
            </span>
          </label>

          {!reservaStock && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                La mercadería de este pedido <strong>no está reservada</strong>: se puede vender a otro
                cliente. Cuando entre el ingreso, destildá esta opción y el stock se descuenta ahí
                mismo (si no alcanza, el sistema avisa y no lo deja).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Plan de cobro — informativo: no genera pagos ni mueve cuenta corriente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Cómo paga</h2>
          <button
            type="button"
            onClick={agregarTramoPago}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-[#003087] bg-[#003087]/10 hover:bg-[#003087]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar forma de pago
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Cómo se va a cobrar y a qué cuenta entra cada parte. Es una indicación para
          cobranza: no registra el cobro ni afecta la cuenta corriente.
        </p>

        {planPago.length === 0 ? (
          <p className="text-sm text-gray-400 py-3">
            Sin especificar. Se puede dejar vacío si el pedido se cobra de una sola forma.
          </p>
        ) : (
          <div className="space-y-2">
            {planPago.map((tramo, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Forma</label>
                  <input
                    type="text"
                    list="formas-pago-sugeridas"
                    value={tramo.forma}
                    onChange={(e) => cambiarTramoPago(idx, { forma: e.target.value })}
                    placeholder="Transferencia, efectivo..."
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
                <div className="col-span-5">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Cuenta destino</label>
                  <select
                    value={tramo.cuenta_id ?? ''}
                    onChange={(e) => cambiarTramoPago(idx, { cuenta_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  >
                    <option value="">Sin definir</option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Importe</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={tramo.importe}
                    onChange={(e) => cambiarTramoPago(idx, { importe: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
                <div className="col-span-1 flex justify-center pb-1">
                  <button
                    type="button"
                    onClick={() => quitarTramoPago(idx)}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-50"
                    title="Quitar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <datalist id="formas-pago-sugeridas">
              {formasPago.map((f) => <option key={f} value={f} />)}
            </datalist>

            <div className="flex justify-end gap-6 pt-2 border-t border-gray-50 text-sm">
              <span className="text-gray-500">
                Asignado: <strong className="text-gray-900">{formatCurrency(totalPlanPago)}</strong>
              </span>
              {Math.abs(totalPlanPago - importeTotal) > 0.009 && (
                <span className={totalPlanPago > importeTotal ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                  {totalPlanPago > importeTotal ? 'Se pasa por ' : 'Faltan asignar '}
                  {formatCurrency(Math.abs(totalPlanPago - importeTotal))}
                </span>
              )}
            </div>
          </div>
        )}
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
            disabled={saving || faltaParaCargar !== null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white bg-[#003087] hover:bg-[#002570] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            title={faltaParaCargar ? `Elegí la ${faltaParaCargar} primero` : 'Agregar producto'}
          >
            <Plus className="w-4 h-4" />
            Agregar Producto
          </button>
        </div>

        {avisosStock.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  Esta cotización pide más de lo que hay disponible
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Se guarda igual. Al confirmarla puede fallar si para ese momento sigue sin haber stock.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {avisosStock.map((a) => (
                    <li key={`${a.producto_id}-${a.deposito_id}`} className="text-xs text-amber-800">
                      <span className="font-medium">{a.producto_nombre}</span>
                      {a.deposito_nombre ? ` en ${a.deposito_nombre}` : ''}: pide {a.pedido}, hay {a.disponible}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#003087]/5 flex items-center justify-center mb-3">
              <Package className="w-7 h-7 text-[#003087]/40" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Todavía no agregaste productos</p>
            {faltaParaCargar ? (
              <p className="text-xs mt-1 text-amber-600 font-medium">
                Elegí {faltaParaCargar === 'sociedad' ? 'una sociedad' : 'un depósito'} arriba para poder cargar productos.
              </p>
            ) : (
              <p className="text-xs mt-1 text-gray-400">Tocá &quot;Agregar Producto&quot; y cargá varios de corrido con &quot;Agregar y seguir&quot;.</p>
            )}
            <button
              type="button"
              onClick={openModal}
              disabled={saving || faltaParaCargar !== null}
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
                  {hayDepositosMixtos && (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Depósito
                    </th>
                  )}
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
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-700">{item.producto_nombre}</td>
                    <td className="px-4 py-2 text-gray-700">{item.presentacion || '-'}</td>
                    {hayDepositosMixtos && (
                      <td className="px-4 py-2 text-gray-700">
                        {item.deposito_nombre
                          ?? depositos.find((d) => d.id === (item.deposito_id ?? depositoId))?.nombre
                          ?? '-'}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={topeDeLinea(item, idx)}
                          value={item.cantidad}
                          onChange={(e) => editarLinea(idx, { cantidad: parseInt(e.target.value, 10) || 0 })}
                          className="w-16 px-1.5 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                        />
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full border ${item.unidad_venta === 'blister' ? 'text-[#00AEEF] bg-[#00AEEF]/10 border-[#00AEEF]/30' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                          {item.unidad_venta === 'blister' ? 'Blíster' : 'Caja'}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={item.descuento_porcentaje ?? 0}
                        onChange={(e) => editarLinea(idx, { descuento_porcentaje: parseFloat(e.target.value) || 0 })}
                        className="w-16 px-1.5 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.precio_unitario}
                        onChange={(e) => editarLinea(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-1.5 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-700 text-right font-semibold">
                      {formatCurrency(item.precio_total)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEdicionLinea(idx)}
                          className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#003087] transition-colors"
                          title="Cambiar producto, depósito o unidad"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          title="Quitar producto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
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
              <h3 className="text-lg font-semibold text-gray-900">
                {editandoIdx === null ? 'Agregar Producto' : 'Editar línea'}
              </h3>
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
                          <span className="block text-gray-400">
                            Stock en {depositos.find((d) => d.id === modalDepositoEfectivo)?.nombre ?? 'depósito'}
                          </span>
                          <span className="font-bold text-gray-900">
                            {getAvailableStock(selectedProduct, modalUnidad, modalDepositoEfectivo)}{' '}
                            {modalUnidad === 'blister' ? 'blísters' : 'cajas'}
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

                    {/* Depósito de la línea: por defecto el del pedido; se cambia
                        cuando la mercadería tiene que salir de otro. */}
                    {depositos.length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Depósito</label>
                        <div className="flex flex-wrap gap-2">
                          {depositos.map((d) => {
                            const disp = getAvailableStock(selectedProduct, modalUnidad, d.id)
                            const activo = modalDepositoEfectivo === d.id
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setModalDeposito(d.id)}
                                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                                  activo
                                    ? 'border-[#003087] bg-blue-50 text-[#003087] font-semibold'
                                    : disp > 0
                                      ? 'border-gray-300 bg-white text-gray-700 hover:border-[#003087]'
                                      : 'border-gray-200 bg-gray-50 text-gray-400'
                                }`}
                              >
                                {d.nombre}
                                <span className="ml-1.5 font-mono">
                                  {disp} {modalUnidad === 'blister' ? 'bl' : 'cj'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
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
                        max={limitaPorStock ? disponibleParaLinea(selectedProduct, modalUnidad, modalDepositoEfectivo, editandoIdx) : undefined}
                        onChange={(e) => handleCantidadChange(e, selectedProduct)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addItem(e.shiftKey) // Enter = agregar; Shift+Enter = agregar y seguir
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                      />
                      {modalStockInsuficiente && (
                        <div className="text-xs mt-1">
                          <p className="text-red-600 font-medium">
                            No hay stock suficiente en{' '}
                            {depositos.find((d) => d.id === modalDepositoEfectivo)?.nombre ?? 'este depósito'} (
                            {getAvailableStock(selectedProduct, modalUnidad, modalDepositoEfectivo)}{' '}
                            {modalUnidad === 'blister' ? 'blísters' : 'cajas'} disponibles).
                          </p>
                          {modalAlternativas.length > 0 && (
                            <p className="text-gray-600 mt-1">
                              Hay stock en:{' '}
                              {modalAlternativas.map((d, i) => (
                                <span key={d.id}>
                                  {i > 0 && ', '}
                                  <button
                                    type="button"
                                    onClick={() => setModalDeposito(d.id)}
                                    className="text-[#003087] font-semibold underline underline-offset-2"
                                  >
                                    {d.nombre} ({getAvailableStock(selectedProduct, modalUnidad, d.id)})
                                  </button>
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      )}
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
                    title={editandoIdx === null ? 'Volver al buscador' : 'Elegir otro producto para esta línea'}
                  >
                    {editandoIdx === null ? 'Volver' : 'Cambiar producto'}
                  </button>
                  {editandoIdx === null && (
                    <button
                      type="button"
                      onClick={() => addItem(true)}
                      disabled={modalSinPreciosComercio || modalStockInsuficiente}
                      className="px-4 py-2 text-sm font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Agrega y vuelve al buscador para cargar otro"
                    >
                      Agregar y seguir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => addItem(false)}
                    disabled={modalSinPreciosComercio || modalStockInsuficiente}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editandoIdx === null ? 'Agregar' : 'Guardar cambios'}
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
