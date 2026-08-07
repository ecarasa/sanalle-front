'use client'

import { useState, useEffect, useCallback } from 'react'
import { Warehouse, Plus, Pencil, Trash2, Check, X, Loader2, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface Deposito {
  id: number
  nombre: string
  activo: boolean
  orden: number
}

export default function DepositosPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Deposito | null>(null)

  const fetchDepositos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/depositos', { params: { incluir_inactivos: true } })
      setDepositos(res.data ?? [])
    } catch {
      toast.error('No se pudieron cargar los depósitos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDepositos() }, [fetchDepositos])

  const handleCreate = async () => {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    setCreating(true)
    try {
      await api.post('/depositos', { nombre })
      toast.success('Depósito creado')
      setNuevoNombre('')
      fetchDepositos()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo crear')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (d: Deposito) => { setEditId(d.id); setEditNombre(d.nombre) }
  const cancelEdit = () => { setEditId(null); setEditNombre('') }

  const handleSaveEdit = async (id: number) => {
    const nombre = editNombre.trim()
    if (!nombre) return
    setSaving(true)
    try {
      await api.put(`/depositos/${id}`, { nombre })
      toast.success('Depósito actualizado')
      cancelEdit()
      fetchDepositos()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (d: Deposito) => {
    try {
      await api.put(`/depositos/${d.id}`, { activo: !d.activo })
      fetchDepositos()
    } catch {
      toast.error('No se pudo cambiar el estado')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      const res = await api.delete(`/depositos/${deleteConfirm.id}`)
      toast.success(res.data?.message || 'Depósito eliminado')
      setDeleteConfirm(null)
      fetchDepositos()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo eliminar')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Depósitos</h1>
          <p className="mt-0.5 text-sm text-gray-500">Administrá los depósitos/almacenes de stock.</p>
        </div>
      </div>

      {/* Crear */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">Nuevo depósito</label>
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Ej. Depósito Central"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003087] focus:outline-none focus:ring-2 focus:ring-[#003087]/20"
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !nuevoNombre.trim()}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #00AEEF 0%, #003087 100%)' }}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Depósito</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
            ) : depositos.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-sm text-gray-400">Sin depósitos. Agregá uno arriba.</td></tr>
            ) : depositos.map((d) => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-2.5">
                  {editId === d.id ? (
                    <input
                      autoFocus
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(d.id); if (e.key === 'Escape') cancelEdit() }}
                      className="w-full max-w-xs rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-[#003087] focus:outline-none focus:ring-2 focus:ring-[#003087]/20"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{d.nombre}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${d.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {d.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {editId === d.id ? (
                      <>
                        <button type="button" onClick={() => handleSaveEdit(d.id)} disabled={saving} className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-50" title="Guardar">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={cancelEdit} className="rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200" title="Cancelar">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(d)} className="rounded-lg bg-gray-100 p-1.5 text-gray-700 hover:bg-gray-200" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => toggleActivo(d)} className={`rounded-lg p-1.5 ${d.activo ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`} title={d.activo ? 'Desactivar' : 'Activar'}>
                          <Power className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(d)} className="rounded-lg bg-red-50 p-1.5 text-red-700 hover:bg-red-100" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">Eliminar depósito</h3>
              <p className="mt-1 text-sm text-gray-500">
                ¿Eliminar <strong>{deleteConfirm.nombre}</strong>? Si tiene existencias, se desactiva en lugar de borrarse.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancelar</button>
                <button type="button" onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
