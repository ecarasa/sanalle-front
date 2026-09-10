'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Landmark, Star, Copy, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { ProveedorCuenta } from '@/types'

interface Props {
  proveedorId: number
  /** Se llama cuando la libreta cambió, para que el padre refresque su copia. */
  onChange?: () => void
}

type Form = {
  etiqueta: string
  banco: string
  titular: string
  cuit: string
  numero_cuenta: string
  cbu: string
  alias: string
  observacion: string
  es_default: boolean
}

const VACIO: Form = {
  etiqueta: '',
  banco: '',
  titular: '',
  cuit: '',
  numero_cuenta: '',
  cbu: '',
  alias: '',
  observacion: '',
  es_default: false,
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]'

/** Los campos opcionales viajan como null, no como string vacío. */
function aPayload(f: Form) {
  const limpio = (v: string) => (v.trim() ? v.trim() : null)
  return {
    etiqueta: f.etiqueta.trim(),
    banco: limpio(f.banco),
    titular: limpio(f.titular),
    cuit: limpio(f.cuit),
    numero_cuenta: limpio(f.numero_cuenta),
    cbu: limpio(f.cbu),
    alias: limpio(f.alias),
    observacion: limpio(f.observacion),
    es_default: f.es_default,
  }
}

/**
 * Libreta de cuentas bancarias de un proveedor.
 *
 * Misma idea que la libreta de direcciones del cliente: varias filas, una marcada
 * por defecto, baja lógica. Se monta dentro del ABM del proveedor y necesita que
 * el proveedor ya exista (hace falta el id para colgarle las cuentas).
 */
export default function CuentasProveedor({ proveedorId, onChange }: Props) {
  const [cuentas, setCuentas] = useState<ProveedorCuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState<Form>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ProveedorCuenta[]>(`/proveedores/${proveedorId}/cuentas`)
      setCuentas(res.data)
    } catch {
      toast.error('No se pudieron cargar las cuentas')
    } finally {
      setLoading(false)
    }
  }, [proveedorId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cerrarForm = () => {
    setCreando(false)
    setEditandoId(null)
    setForm(VACIO)
  }

  const abrirCrear = () => {
    setEditandoId(null)
    // La primera cuenta arranca marcada: si es la única, es la que se va a usar.
    setForm({ ...VACIO, es_default: cuentas.length === 0 })
    setCreando(true)
  }

  const abrirEditar = (c: ProveedorCuenta) => {
    setCreando(false)
    setEditandoId(c.id)
    setForm({
      etiqueta: c.etiqueta,
      banco: c.banco ?? '',
      titular: c.titular ?? '',
      cuit: c.cuit ?? '',
      numero_cuenta: c.numero_cuenta ?? '',
      cbu: c.cbu ?? '',
      alias: c.alias ?? '',
      observacion: c.observacion ?? '',
      es_default: c.es_default,
    })
  }

  const guardar = async () => {
    if (!form.etiqueta.trim()) {
      toast.error('Poné una etiqueta para reconocer la cuenta')
      return
    }
    setGuardando(true)
    try {
      if (editandoId) {
        await api.put(`/proveedores/${proveedorId}/cuentas/${editandoId}`, aPayload(form))
        toast.success('Cuenta actualizada')
      } else {
        await api.post(`/proveedores/${proveedorId}/cuentas`, aPayload(form))
        toast.success('Cuenta agregada')
      }
      cerrarForm()
      await cargar()
      onChange?.()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      // Un 422 de Pydantic viene como lista de errores; el CBU inválido cae acá.
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' · ')
        : typeof detail === 'string'
          ? detail
          : 'No se pudo guardar la cuenta'
      toast.error(msg)
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (c: ProveedorCuenta) => {
    setBorrando(c.id)
    try {
      await api.delete(`/proveedores/${proveedorId}/cuentas/${c.id}`)
      toast.success('Cuenta dada de baja')
      await cargar()
      onChange?.()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'No se pudo dar de baja')
    } finally {
      setBorrando(null)
    }
  }

  const marcarDefault = async (c: ProveedorCuenta) => {
    try {
      await api.put(`/proveedores/${proveedorId}/cuentas/${c.id}`, { es_default: true })
      await cargar()
      onChange?.()
    } catch {
      toast.error('No se pudo marcar como predeterminada')
    }
  }

  const copiar = (texto: string, que: string) => {
    navigator.clipboard?.writeText(texto)
      .then(() => toast.success(`${que} copiado`))
      .catch(() => toast.error(`No se pudo copiar el ${que.toLowerCase()}`))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#003087] uppercase tracking-wider">
          Cuentas bancarias
        </h3>
        {!creando && editandoId === null && (
          <button
            type="button"
            onClick={abrirCrear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar cuenta
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-1">
        A dónde se le paga a este proveedor. La marcada con estrella es la que se propone al
        registrar un pago.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {cuentas.length === 0 && !creando && (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
              <Landmark className="w-7 h-7 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Todavía no cargaste ninguna cuenta</p>
            </div>
          )}

          {cuentas.map((c) => (
            editandoId === c.id ? (
              <CuentaForm
                key={c.id}
                form={form}
                setForm={setForm}
                guardando={guardando}
                onGuardar={guardar}
                onCancelar={cerrarForm}
              />
            ) : (
              <div key={c.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{c.etiqueta}</span>
                      {c.es_default && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Predeterminada
                        </span>
                      )}
                      {c.banco && <span className="text-xs text-gray-500">{c.banco}</span>}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                      {c.titular && (
                        <p>
                          {c.titular}
                          {c.cuit ? ` · CUIT ${c.cuit}` : ''}
                        </p>
                      )}
                      {c.cbu && (
                        <p className="font-mono flex items-center gap-1.5">
                          CBU {c.cbu}
                          <button
                            type="button"
                            onClick={() => copiar(c.cbu!, 'CBU')}
                            className="text-gray-400 hover:text-[#003087]"
                            title="Copiar CBU"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </p>
                      )}
                      {c.alias && (
                        <p className="flex items-center gap-1.5">
                          Alias {c.alias}
                          <button
                            type="button"
                            onClick={() => copiar(c.alias!, 'Alias')}
                            className="text-gray-400 hover:text-[#003087]"
                            title="Copiar alias"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </p>
                      )}
                      {c.numero_cuenta && <p>N° {c.numero_cuenta}</p>}
                      {c.observacion && <p className="text-gray-400 italic">{c.observacion}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!c.es_default && (
                      <button
                        type="button"
                        onClick={() => marcarDefault(c)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        title="Marcar como predeterminada"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirEditar(c)}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => borrar(c)}
                      disabled={borrando === c.id}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Dar de baja"
                    >
                      {borrando === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}

          {creando && (
            <CuentaForm
              form={form}
              setForm={setForm}
              guardando={guardando}
              onGuardar={guardar}
              onCancelar={cerrarForm}
            />
          )}
        </div>
      )}
    </div>
  )
}

function CuentaForm({
  form,
  setForm,
  guardando,
  onGuardar,
  onCancelar,
}: {
  form: Form
  setForm: (f: Form) => void
  guardando: boolean
  onGuardar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="border-2 border-[#003087]/20 rounded-xl p-3 space-y-3 bg-[#003087]/[0.02]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#003087] uppercase tracking-wide">Datos de la cuenta</span>
        <button type="button" onClick={onCancelar} className="p-1 rounded hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Etiqueta <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.etiqueta}
            onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
            placeholder="Ej: Santander principal"
            className={inputCls}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Banco</label>
          <input type="text" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Titular</label>
          <input type="text" value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CUIT del titular</label>
          <input type="text" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} placeholder="30-12345678-9" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">N° de cuenta</label>
          <input type="text" value={form.numero_cuenta} onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CBU</label>
          <input
            type="text"
            value={form.cbu}
            onChange={(e) => setForm({ ...form, cbu: e.target.value })}
            placeholder="22 dígitos"
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Alias</label>
          <input type="text" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Observación</label>
          <input type="text" value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.es_default}
          onChange={(e) => setForm({ ...form, es_default: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-[#003087] focus:ring-[#003087]/40"
        />
        <span className="text-sm text-gray-700">Usar esta cuenta por defecto al pagarle</span>
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
          Guardar cuenta
        </button>
      </div>
    </div>
  )
}
