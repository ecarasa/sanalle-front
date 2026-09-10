'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  History,
  PlusCircle,
  Pencil,
  Trash2,
  Truck,
  CreditCard,
  Percent,
  UserCheck,
  User,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { BitacoraEntrada, PaginatedResponse } from '@/types'

const CAMPO_LABEL: Record<string, string> = {
  shipping_status: 'Estado de despacho',
  payment_status: 'Estado de pago',
  fecha_entrega: 'Fecha de entrega',
  tipo_precio: 'Lista de precios',
  tipo_cliente: 'Tipo de cliente',
  cantidad_cajas: 'Cantidad (cajas)',
  cantidad_blisters: 'Cantidad (blísters)',
  unidad_venta: 'Unidad de venta',
  precio_unitario: 'Precio unitario',
  precio_lista: 'Precio de lista',
  descuento_porcentaje: 'Descuento %',
  comision_vendedor: 'Comisión',
  repartidor_id: 'Repartidor',
  vendedor_id: 'Vendedor',
  importe_total: 'Importe total',
  transporte: 'Transporte',
  observacion: 'Observación',
  bultos: 'Bultos',
  reserva_stock: 'Descuenta stock',
  aplica_umbral_mayorista: 'Escala a mayorista por volumen',
  tiene_excepcion_precio: 'Precios fuera de lista',
  sociedad: 'Sociedad',
  tipo_documento: 'Tipo de documento',
  despachado: 'Despachado',
  fecha_compromiso_pago: 'Compromiso de pago',
}

/** Campos cuyo valor es plata y se muestra con formatCurrency. */
const CAMPOS_MONEDA = new Set([
  'precio_unitario',
  'precio_lista',
  'importe_total',
  'comision_vendedor',
])

interface EventoDef {
  label: string
  icon: typeof History
  iconClass: string
  dotClass: string
}

const EVENTO_DEF: Record<string, EventoDef> = {
  creacion: {
    label: 'Creación del pedido',
    icon: PlusCircle,
    iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    dotClass: 'bg-emerald-500',
  },
  actualizacion: {
    label: 'Edición del pedido',
    icon: Pencil,
    iconClass: 'bg-blue-50 text-[#003087] ring-blue-100',
    dotClass: 'bg-[#003087]',
  },
  eliminacion: {
    label: 'Eliminación del pedido',
    icon: Trash2,
    iconClass: 'bg-rose-50 text-[#E31837] ring-rose-100',
    dotClass: 'bg-[#E31837]',
  },
  cambio_estado_despacho: {
    label: 'Cambio de estado de despacho',
    icon: Truck,
    iconClass: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
    dotClass: 'bg-[#00AEEF]',
  },
  cambio_estado_pago: {
    label: 'Cambio de estado de pago',
    icon: CreditCard,
    iconClass: 'bg-amber-50 text-amber-600 ring-amber-100',
    dotClass: 'bg-amber-500',
  },
  comision_item: {
    label: 'Comisión de vendedor',
    icon: Percent,
    iconClass: 'bg-violet-50 text-violet-600 ring-violet-100',
    dotClass: 'bg-violet-500',
  },
  asignacion_repartidor: {
    label: 'Asignación de repartidor',
    icon: UserCheck,
    iconClass: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    dotClass: 'bg-indigo-500',
  },
}

const EVENTO_FALLBACK: EventoDef = {
  label: 'Movimiento',
  icon: History,
  iconClass: 'bg-gray-50 text-gray-500 ring-gray-100',
  dotClass: 'bg-gray-400',
}

function eventoDef(evento: string): EventoDef {
  return EVENTO_DEF[evento] ?? { ...EVENTO_FALLBACK, label: evento.replace(/_/g, ' ') }
}

function campoLabel(campo: string | null): string {
  if (!campo) return 'Campo'
  return CAMPO_LABEL[campo] ?? campo.replace(/_/g, ' ')
}

/** Formatea un valor de bitácora (siempre llega como string). Si es un campo de
 *  plata y parsea a número, lo muestra con formatCurrency; si no, tal cual. */
function formatValor(valor: string | null, campo: string | null): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (campo && CAMPOS_MONEDA.has(campo)) {
    const parsed = Number(valor)
    if (Number.isFinite(parsed)) return formatCurrency(parsed)
  }
  return valor
}

function formatFechaHora(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Grupo {
  key: string
  created_at: string
  usuario_nombre: string | null
  evento: string
  entradas: BitacoraEntrada[]
}

function agruparEntradas(entradas: BitacoraEntrada[]): Grupo[] {
  const grupos: Grupo[] = []
  const porGrupoId = new Map<string, Grupo>()

  for (const entrada of entradas) {
    // Las entradas sin grupo_id son un grupo propio (clave única por id).
    const key = entrada.grupo_id ?? `entrada-${entrada.id}`
    const existente = entrada.grupo_id ? porGrupoId.get(key) : undefined

    if (existente) {
      existente.entradas.push(entrada)
      continue
    }

    const grupo: Grupo = {
      key,
      created_at: entrada.created_at,
      usuario_nombre: entrada.usuario_nombre,
      evento: entrada.evento,
      entradas: [entrada],
    }
    grupos.push(grupo)
    if (entrada.grupo_id) porGrupoId.set(key, grupo)
  }

  // Más nuevo primero.
  return grupos.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/** Convierte una entrada en una frase legible en español. */
function Cambio({ entrada }: { entrada: BitacoraEntrada }) {
  const producto = entrada.producto_nombre || (entrada.producto_id ? `Producto #${entrada.producto_id}` : 'Producto')

  if (entrada.entidad === 'pedido' && entrada.evento === 'creacion') {
    return <span className="text-gray-700">Creó el pedido</span>
  }

  if (entrada.evento === 'eliminacion') {
    return <span className="text-gray-700">Eliminó el pedido</span>
  }

  if (entrada.entidad === 'item' && entrada.accion === 'alta') {
    return (
      <span className="text-gray-700">
        <span className="font-semibold text-emerald-700">Agregó</span>{' '}
        <span className="font-medium text-gray-900">{producto}</span>
        {entrada.valor_nuevo ? (
          <>: <span className="text-gray-600">{formatValor(entrada.valor_nuevo, entrada.campo)}</span></>
        ) : null}
      </span>
    )
  }

  if (entrada.entidad === 'item' && entrada.accion === 'baja') {
    return (
      <span className="text-gray-700">
        <span className="font-semibold text-[#E31837]">Quitó</span>{' '}
        <span className="font-medium text-gray-900">{producto}</span>
        {entrada.valor_anterior ? (
          <span className="text-gray-500"> ({formatValor(entrada.valor_anterior, entrada.campo)})</span>
        ) : null}
      </span>
    )
  }

  // Modificación (item o pedido).
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-gray-700">
      {entrada.entidad === 'item' && (
        <>
          <span className="font-medium text-gray-900">{producto}</span>
          <span className="text-gray-300">—</span>
        </>
      )}
      <span className="font-medium text-gray-900">{campoLabel(entrada.campo)}:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs line-through decoration-gray-300">
          {formatValor(entrada.valor_anterior, entrada.campo)}
        </span>
        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#003087] text-xs font-semibold">
          {formatValor(entrada.valor_nuevo, entrada.campo)}
        </span>
      </span>
    </span>
  )
}

function BitacoraSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 bg-gray-100 rounded w-1/3" />
            <div className="h-3 bg-gray-50 rounded w-1/4" />
            <div className="h-9 bg-gray-50 rounded-xl w-full mt-3" />
            <div className="h-9 bg-gray-50 rounded-xl w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BitacoraPedido({ pedidoId }: { pedidoId: number }) {
  const [entradas, setEntradas] = useState<BitacoraEntrada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(false)

    api
      .get<PaginatedResponse<BitacoraEntrada>>(`/pedidos/${pedidoId}/bitacora`, {
        params: { page: 1, page_size: 200 },
      })
      .then((res) => {
        if (cancelado) return
        setEntradas(res.data.items ?? [])
      })
      .catch(() => {
        if (cancelado) return
        setError(true)
        setEntradas([])
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [pedidoId])

  const grupos = useMemo(() => agruparEntradas(entradas), [entradas])

  if (loading) return <BitacoraSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-10 text-center">
        <Info className="w-8 h-8 mx-auto mb-3 text-[#E31837]/40" />
        <p className="text-sm font-semibold text-gray-900">No se pudo cargar la bitácora</p>
        <p className="text-xs text-gray-500 mt-1">Intentá volver a abrir el pedido.</p>
      </div>
    )
  }

  if (grupos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
        <div className="w-16 h-16 bg-[#003087]/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-[#003087]/30" />
        </div>
        <h3 className="text-sm font-bold text-gray-900">Sin movimientos registrados</h3>
        <p className="text-xs text-gray-500 mt-1">
          Todavía no hay cambios auditados para este pedido.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Línea vertical del timeline */}
      <div className="absolute left-5 top-3 bottom-3 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent" aria-hidden />

      <ol className="space-y-5">
        {grupos.map((grupo) => {
          const def = eventoDef(grupo.evento)
          const Icono = def.icon
          return (
            <li key={grupo.key} className="relative flex gap-4">
              {/* Icono del evento */}
              <div
                className={`relative z-10 shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-4 ring-white ${def.iconClass}`}
              >
                <Icono className="w-[18px] h-[18px]" />
              </div>

              {/* Contenido del grupo */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${def.dotClass}`} />
                    <span className="text-sm font-bold text-gray-900">{def.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatFechaHora(grupo.created_at)}
                  </span>
                </div>

                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3 text-gray-300" />
                  {grupo.usuario_nombre || 'Sistema'}
                </p>

                <ul className="mt-2.5 rounded-xl border border-gray-100 bg-white divide-y divide-gray-50 shadow-sm overflow-hidden">
                  {grupo.entradas.map((entrada) => (
                    <li
                      key={entrada.id}
                      className="px-3.5 py-2.5 text-sm hover:bg-blue-50/30 transition-colors"
                    >
                      <Cambio entrada={entrada} />
                      {entrada.observacion && (
                        <p className="mt-1 text-xs text-gray-400 italic">{entrada.observacion}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
