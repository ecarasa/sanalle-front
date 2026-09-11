'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, MapPin, Star, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { ClienteDireccion } from '@/types'

interface Localidad {
  id: number
  nombre: string
}

/** Una dirección todavía sin guardar: no tiene id porque el cliente no existe aún. */
export interface DireccionPendiente {
  etiqueta: string
  direccion: string
  localidad_id: number | null
  codigo_postal: string | null
  es_default: boolean
}

interface Props {
  /** null = alta: el cliente todavía no existe y las direcciones se juntan acá. */
  clienteId: number | null
  localidades: Localidad[]
  /** Sólo en alta: el buffer que el formulario padre va a persistir al crear. */
  pendientes?: DireccionPendiente[]
  onPendientesChange?: (d: DireccionPendiente[]) => void
  /** Se usa para proponer la primera dirección a partir del domicilio fiscal. */
  domicilioFiscal?: string
  localidadFiscalId?: string
}

type Form = {
  etiqueta: string
  direccion: string
  localidad_id: string
  codigo_postal: string
  es_default: boolean
}

const VACIO: Form = { etiqueta: '', direccion: '', localidad_id: '', codigo_postal: '', es_default: false }

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]'

/**
 * Libreta de direcciones de entrega del cliente.
 *
 * No reemplaza al `domicilio` de la ficha, que es la dirección fiscal y sigue
 * siendo una sola. Esto es aparte: la mercadería puede ir a varios lados
 * (sucursales, depósito del cliente, domicilio particular) y cada pedido elige
 * a cuál. La marcada como principal es la que se propone sola al cargar uno.
 *
 * Funciona en dos modos porque tiene que servir al alta y a la edición:
 *   - con `clienteId`: guarda directo contra la API.
 *   - sin `clienteId` (alta): acumula en `pendientes` y el formulario padre las
 *     persiste después de crear al cliente, cuando por fin hay un id.
 */
export default function DireccionesCliente({
  clienteId,
  localidades,
  pendientes = [],
  onPendientesChange,
  domicilioFiscal,
  localidadFiscalId,
}: Props) {
  const esAlta = clienteId === null

  const [guardadas, setGuardadas] = useState<ClienteDireccion[]>([])
  const [loading, setLoading] = useState(!esAlta)
  const [creando, setCreando] = useState(false)
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [form, setForm] = useState<Form>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    if (clienteId === null) return
    setLoading(true)
    try {
      const res = await api.get<ClienteDireccion[]>(`/clientes/${clienteId}/direcciones`)
      setGuardadas(res.data)
    } catch {
      toast.error('No se pudieron cargar las direcciones')
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    if (!esAlta) cargar()
  }, [esAlta, cargar])

  // Lo que se muestra: en alta el buffer, en edición lo que vino de la API.
  const filas: DireccionPendiente[] = esAlta
    ? pendientes
    : guardadas.map((d) => ({
        etiqueta: d.etiqueta,
        direccion: d.direccion,
        localidad_id: d.localidad_id,
        codigo_postal: d.codigo_postal,
        es_default: d.es_default,
      }))

  const nombreLocalidad = (id: number | null) =>
    id === null ? null : localidades.find((l) => l.id === id)?.nombre ?? null

  const cerrar = () => {
    setCreando(false)
    setEditandoIdx(null)
    setForm(VACIO)
  }

  const abrirCrear = () => {
    setEditandoIdx(null)
    // La primera se propone con el domicilio fiscal: en la mayoría de los casos
    // la entrega va ahí, y retipearlo es la clase de fricción que hace que nadie
    // cargue la libreta.
    const primera = filas.length === 0
    setForm({
      ...VACIO,
      etiqueta: primera ? 'Principal' : '',
      direccion: primera ? (domicilioFiscal ?? '') : '',
      localidad_id: primera ? (localidadFiscalId ?? '') : '',
      es_default: primera,
    })
    setCreando(true)
  }

  const abrirEditar = (idx: number) => {
    const d = filas[idx]
    setCreando(false)
    setEditandoIdx(idx)
    setForm({
      etiqueta: d.etiqueta,
      direccion: d.direccion,
      localidad_id: d.localidad_id != null ? String(d.localidad_id) : '',
      codigo_postal: d.codigo_postal ?? '',
      es_default: d.es_default,
    })
  }

  const aPayload = (f: Form): DireccionPendiente => ({
    etiqueta: f.etiqueta.trim(),
    direccion: f.direccion.trim(),
    localidad_id: f.localidad_id ? Number(f.localidad_id) : null,
    codigo_postal: f.codigo_postal.trim() || null,
    es_default: f.es_default,
  })

  /** Deja una sola marcada como principal. Espeja lo que hace el backend. */
  const unaSolaDefault = (lista: DireccionPendiente[], idxDefault: number) =>
    lista.map((d, i) => ({ ...d, es_default: i === idxDefault }))

  const guardar = async () => {
    if (!form.etiqueta.trim()) {
      toast.error('Poné una etiqueta para reconocer la dirección')
      return
    }
    if (!form.direccion.trim()) {
      toast.error('La dirección es obligatoria')
      return
    }
    const payload = aPayload(form)

    // --- Alta: sólo se toca el buffer, no hay a quién colgarle nada todavía ---
    if (esAlta) {
      let next = [...pendientes]
      if (editandoIdx !== null) next[editandoIdx] = payload
      else next.push(payload)
      const idxDefault = payload.es_default
        ? (editandoIdx !== null ? editandoIdx : next.length - 1)
        : next.findIndex((d) => d.es_default)
      // Si ninguna quedó marcada, la primera manda: el pedido necesita una.
      next = unaSolaDefault(next, idxDefault === -1 ? 0 : idxDefault)
      onPendientesChange?.(next)
      cerrar()
      return
    }

    // --- Edición: va directo contra la API ---
    setGuardando(true)
    try {
      if (editandoIdx !== null) {
        await api.put(`/clientes/${clienteId}/direcciones/${guardadas[editandoIdx].id}`, payload)
        toast.success('Dirección actualizada')
      } else {
        await api.post(`/clientes/${clienteId}/direcciones`, {
          ...payload,
          // La primera siempre es la principal, aunque no la hayan tildado.
          es_default: payload.es_default || guardadas.length === 0,
        })
        toast.success('Dirección agregada')
      }
      cerrar()
      await cargar()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' · ')
        : typeof detail === 'string' ? detail : 'No se pudo guardar la dirección'
      toast.error(msg)
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (idx: number) => {
    if (esAlta) {
      let next = pendientes.filter((_, i) => i !== idx)
      // Si se fue la principal, asciende la primera que quede.
      if (next.length > 0 && !next.some((d) => d.es_default)) next = unaSolaDefault(next, 0)
      onPendientesChange?.(next)
      return
    }
    const d = guardadas[idx]
    setBorrando(d.id)
    try {
      await api.delete(`/clientes/${clienteId}/direcciones/${d.id}`)
      toast.success('Dirección dada de baja')
      await cargar()
    } catch {
      toast.error('No se pudo dar de baja')
    } finally {
      setBorrando(null)
    }
  }

  const marcarPrincipal = async (idx: number) => {
    if (esAlta) {
      onPendientesChange?.(unaSolaDefault(pendientes, idx))
      return
    }
    try {
      await api.put(`/clientes/${clienteId}/direcciones/${guardadas[idx].id}`, { es_default: true })
      await cargar()
    } catch {
      toast.error('No se pudo marcar como principal')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#003087] uppercase tracking-wider">
          Direcciones de entrega
        </h3>
        {!creando && editandoIdx === null && (
          <button
            type="button"
            onClick={abrirCrear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar dirección
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-1">
        A dónde se le manda la mercadería. Es aparte del domicilio de arriba, que es el fiscal.
        La marcada con estrella se propone sola al cargar un pedido.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {filas.length === 0 && !creando && (
            <div className="text-center py-5 border border-dashed border-gray-200 rounded-xl">
              <MapPin className="w-6 h-6 mx-auto text-gray-300 mb-1.5" />
              <p className="text-xs text-gray-500">
                Sin direcciones cargadas. Los pedidos van a usar el domicilio de la ficha.
              </p>
            </div>
          )}

          {filas.map((d, idx) => (
            editandoIdx === idx ? (
              <DireccionForm
                key={`edit-${idx}`}
                form={form}
                setForm={setForm}
                localidades={localidades}
                guardando={guardando}
                onGuardar={guardar}
                onCancelar={cerrar}
              />
            ) : (
              <div key={`row-${idx}`} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{d.etiqueta}</span>
                      {d.es_default && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{d.direccion}</p>
                    {(nombreLocalidad(d.localidad_id) || d.codigo_postal) && (
                      <p className="text-[11px] text-gray-400">
                        {[nombreLocalidad(d.localidad_id), d.codigo_postal].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!d.es_default && (
                      <button
                        type="button"
                        onClick={() => marcarPrincipal(idx)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        title="Marcar como principal"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirEditar(idx)}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => borrar(idx)}
                      disabled={!esAlta && borrando === guardadas[idx]?.id}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title={esAlta ? 'Quitar' : 'Dar de baja'}
                    >
                      {!esAlta && borrando === guardadas[idx]?.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}

          {creando && (
            <DireccionForm
              form={form}
              setForm={setForm}
              localidades={localidades}
              guardando={guardando}
              onGuardar={guardar}
              onCancelar={cerrar}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DireccionForm({
  form,
  setForm,
  localidades,
  guardando,
  onGuardar,
  onCancelar,
}: {
  form: Form
  setForm: (f: Form) => void
  localidades: Localidad[]
  guardando: boolean
  onGuardar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="border-2 border-[#003087]/20 rounded-xl p-3 space-y-3 bg-[#003087]/[0.02]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#003087] uppercase tracking-wide">Datos de la dirección</span>
        <button type="button" onClick={onCancelar} className="p-1 rounded hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Etiqueta <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.etiqueta}
            onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
            placeholder="Ej: Sucursal Centro"
            className={inputCls}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Código postal</label>
          <input
            type="text"
            value={form.codigo_postal}
            onChange={(e) => setForm({ ...form, codigo_postal: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Dirección <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Calle, número, piso"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Localidad</label>
          <select
            value={form.localidad_id}
            onChange={(e) => setForm({ ...form, localidad_id: e.target.value })}
            className={inputCls}
          >
            <option value="">Sin especificar</option>
            {localidades.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-400">
            Sin localidad no se puede ubicar en el mapa de reparto.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.es_default}
          onChange={(e) => setForm({ ...form, es_default: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-[#003087] focus:ring-[#003087]/40"
        />
        <span className="text-sm text-gray-700">Usar como dirección principal</span>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
        >
          {guardando && <Loader2 className="w-3 h-3 animate-spin" />}
          Guardar dirección
        </button>
      </div>
    </div>
  )
}
