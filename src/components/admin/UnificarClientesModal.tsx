'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, ArrowRight, GitMerge, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface ClienteMin {
  id: number
  nombre: string
  localidad_nombre?: string | null
}

const LABELS: Record<string, string> = {
  pedidos: 'Pedidos',
  pagos: 'Pagos',
  notas: 'Notas NC/ND',
  solicitudes: 'Solicitudes',
}

export default function UnificarClientesModal({
  onClose,
  onMerged,
}: {
  onClose: () => void
  onMerged: () => void
}) {
  const [clientes, setClientes] = useState<ClienteMin[]>([])
  const [loading, setLoading] = useState(true)
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [preview, setPreview] = useState<Record<string, number> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/clientes', { params: { page_size: 1000 } })
        const items = (res.data?.items ?? []) as ClienteMin[]
        items.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setClientes(items)
      } catch {
        toast.error('No se pudieron cargar los clientes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Preview de registros asociados al ORIGEN (lo que se va a mover)
  useEffect(() => {
    if (!origenId) {
      setPreview(null)
      return
    }
    let cancel = false
    setPreviewLoading(true)
    api
      .get(`/clientes/${origenId}/asociados`)
      .then((r) => { if (!cancel) setPreview(r.data.asociados) })
      .catch(() => { if (!cancel) setPreview(null) })
      .finally(() => { if (!cancel) setPreviewLoading(false) })
    return () => { cancel = true }
  }, [origenId])

  const origen = useMemo(() => clientes.find((c) => String(c.id) === origenId), [clientes, origenId])
  const destino = useMemo(() => clientes.find((c) => String(c.id) === destinoId), [clientes, destinoId])
  const sameError = !!origenId && origenId === destinoId
  const canMerge = !!origenId && !!destinoId && !sameError

  const totalAsociados = preview ? Object.values(preview).reduce((a, b) => a + b, 0) : 0

  const handleMerge = async () => {
    setMerging(true)
    try {
      const res = await api.post('/clientes/merge', {
        origen_id: Number(origenId),
        destino_id: Number(destinoId),
      })
      const m = res.data.movidos || {}
      toast.success(
        `Unificado en "${res.data.destino_nombre}": ${m.pedidos || 0} pedidos y ${m.pagos || 0} pagos movidos. Se eliminó "${res.data.origen_nombre}".`,
        { duration: 7000 }
      )
      onMerged()
      onClose()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo unificar')
    } finally {
      setMerging(false)
      setConfirming(false)
    }
  }

  const ClienteSelect = ({
    label, value, onChange, hint,
  }: { label: string; value: string; onChange: (v: string) => void; hint: string }) => (
    <div className="flex-1 min-w-0">
      <label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#003087] focus:outline-none focus:ring-2 focus:ring-[#003087]/20 disabled:bg-gray-50"
      >
        <option value="">{loading ? 'Cargando clientes…' : 'Seleccionar cliente…'}</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}{c.localidad_nombre ? ` — ${c.localidad_nombre}` : ''} (#{c.id})
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}>
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-900">Unificar clientes</h2>
              <p className="text-sm text-gray-500">Mueve todo del origen al destino y elimina el duplicado.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <ClienteSelect
              label="Cliente ORIGEN"
              value={origenId}
              onChange={setOrigenId}
              hint="Se absorbe y se ELIMINA."
            />
            <div className="hidden sm:flex sm:pt-8 sm:px-1 text-gray-300">
              <ArrowRight className="h-5 w-5" />
            </div>
            <ClienteSelect
              label="Cliente DESTINO"
              value={destinoId}
              onChange={setDestinoId}
              hint="Se conserva y recibe todo."
            />
          </div>

          {sameError && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" /> El origen y el destino no pueden ser el mismo cliente.
            </p>
          )}

          {/* Preview */}
          {origenId && !sameError && (
            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Se moverá de <span className="text-gray-800">{origen?.nombre}</span>{destino ? <> a <span className="text-gray-800">{destino.nombre}</span></> : ''}
              </p>
              {previewLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</div>
              ) : preview ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(preview).map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                      {LABELS[k] || k}: <span className="font-bold text-[#003087] tabular-nums">{v}</span>
                    </span>
                  ))}
                  {totalAsociados === 0 && <span className="text-xs text-gray-400">Sin registros asociados (solo se elimina el duplicado).</span>}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-amber-700">
                ⚠️ Acción irreversible: el cliente origen se elimina definitivamente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100">
            Cancelar
          </button>
          {!confirming ? (
            <button
              type="button"
              disabled={!canMerge}
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
            >
              <GitMerge className="h-4 w-4" /> Unificar
            </button>
          ) : (
            <button
              type="button"
              disabled={merging}
              onClick={handleMerge}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              {merging ? 'Unificando…' : 'Confirmar (irreversible)'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
