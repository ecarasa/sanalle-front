'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, FlaskConical, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Laboratorio, PaginatedResponse } from '@/types'

interface LaboratorioForm {
  nombre: string
}

const emptyForm: LaboratorioForm = {
  nombre: '',
}

/**
 * Normaliza un nombre igual que `_clave()` del backend (sin acentos, sin espacios
 * dobles, minúsculas). Se duplica acá sólo para la vista previa del modal: quien
 * decide el match de verdad es el servidor.
 */
function clave(nombre: string): string {
  return nombre
    .normalize('NFD')
    // Marcas diacríticas combinantes: escapadas para que el archivo no dependa
    // de que el editor conserve caracteres invisibles.
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export default function LaboratoriosPage() {
  useAuth()
  const [data, setData] = useState<Laboratorio[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLaboratorio, setEditingLaboratorio] = useState<Laboratorio | null>(null)
  const [form, setForm] = useState<LaboratorioForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Laboratorio | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [ordenModalOpen, setOrdenModalOpen] = useState(false)
  const [ordenTexto, setOrdenTexto] = useState('')
  const [ordenando, setOrdenando] = useState(false)

  const fetchLaboratorios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<Laboratorio>>('/laboratorios', { params: { page_size: 200 } })
      setData(res.data.items)
    } catch {
      toast.error('Error al cargar laboratorios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLaboratorios()
  }, [fetchLaboratorios])

  const openCreate = () => {
    setEditingLaboratorio(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (laboratorio: Laboratorio) => {
    setEditingLaboratorio(laboratorio)
    setForm({ nombre: laboratorio.nombre })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingLaboratorio(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre,
      }
      if (editingLaboratorio) {
        await api.put(`/laboratorios/${editingLaboratorio.id}`, payload)
        toast.success('Laboratorio actualizado correctamente')
      } else {
        await api.post('/laboratorios', payload)
        toast.success('Laboratorio creado correctamente')
      }
      closeModal()
      fetchLaboratorios()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al guardar laboratorio')
    } finally {
      setSaving(false)
    }
  }

  /** Manda la secuencia completa de ids. El backend acomoda el resto detrás. */
  const guardarOrden = useCallback(async (ids: number[]) => {
    const previo = data
    try {
      await api.put('/laboratorios/orden', { ids })
      fetchLaboratorios()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'No se pudo guardar el orden')
      setData(previo)
    }
  }, [data, fetchLaboratorios])

  /** Intercambia una fila con su vecina. `delta` es -1 (subir) o +1 (bajar). */
  const mover = (idx: number, delta: number) => {
    const destino = idx + delta
    if (destino < 0 || destino >= data.length) return
    const copia = [...data]
    ;[copia[idx], copia[destino]] = [copia[destino], copia[idx]]
    // Optimista: la lista se reacomoda ya y el fetch confirma. Si el PUT falla se
    // revierte, para que no quede mostrando un orden que la base no aceptó.
    setData(copia)
    guardarOrden(copia.map((l) => l.id))
  }

  // Vista previa del pegado: qué línea matchea, cuál no existe y cuál está repetida.
  const previaOrden = useMemo(() => {
    const porClave = new Map(data.map((l) => [clave(l.nombre), l]))
    const vistos = new Set<string>()
    return ordenTexto
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean)
      .map((nombre) => {
        const k = clave(nombre)
        const lab = porClave.get(k)
        if (!lab) return { nombre, estado: 'no_encontrado' as const }
        if (vistos.has(k)) return { nombre, estado: 'duplicado' as const }
        vistos.add(k)
        return { nombre, estado: 'ok' as const, lab }
      })
  }, [ordenTexto, data])

  const aplicarOrdenPegado = async () => {
    const nombres = previaOrden.filter((p) => p.estado === 'ok').map((p) => p.nombre)
    if (nombres.length === 0) {
      toast.error('Ninguna línea coincide con un laboratorio existente')
      return
    }
    setOrdenando(true)
    try {
      const res = await api.put<{ aplicados: number; no_encontrados: string[] }>(
        '/laboratorios/orden',
        { nombres }
      )
      const { aplicados, no_encontrados } = res.data
      toast.success(
        `${aplicados} laboratorio${aplicados === 1 ? '' : 's'} ordenado${aplicados === 1 ? '' : 's'}` +
        (no_encontrados.length ? `. Sin coincidencia: ${no_encontrados.join(', ')}` : '')
      )
      setOrdenModalOpen(false)
      setOrdenTexto('')
      fetchLaboratorios()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'No se pudo aplicar el orden')
    } finally {
      setOrdenando(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await api.delete(`/laboratorios/${deleteConfirm.id}`)
      toast.success('Laboratorio eliminado correctamente')
      setDeleteConfirm(null)
      fetchLaboratorios()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al eliminar laboratorio')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Laboratorios</h1>
          <p className="text-sm text-gray-500 mt-1">
            El orden de esta lista es el que usan la lista de precios y las exportaciones
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setOrdenModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors"
            title="Pegar el orden desde una lista"
          >
            <ListOrdered className="w-4 h-4" />
            Ordenar por lista
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Laboratorio
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#003087]" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay laboratorios registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">#</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((lab, idx) => (
                <tr key={lab.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{lab.orden || '-'}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{lab.nombre}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lab.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {lab.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => mover(idx, -1)}
                        disabled={idx === 0}
                        className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Subir"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(idx, 1)}
                        disabled={idx === data.length - 1}
                        className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Bajar"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(lab)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(lab)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ordenar pegando la lista (típicamente copiada del PDF del cliente) */}
      {ordenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOrdenModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#003087]/10">
                  <ListOrdered className="w-5 h-5 text-[#003087]" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Ordenar por lista</h2>
              </div>
              <button type="button" onClick={() => setOrdenModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-gray-500">
                Pegá los nombres de los laboratorios, <strong>uno por línea</strong>, en el orden que
                querés que aparezcan en la lista de precios. Los que no menciones quedan detrás, en
                orden alfabético.
              </p>
              <textarea
                value={ordenTexto}
                onChange={(e) => setOrdenTexto(e.target.value)}
                rows={8}
                placeholder={'GADOR\nBAGÓ\nKLONAL\n...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                autoFocus
              />

              {previaOrden.length > 0 && (
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-52 overflow-y-auto">
                  {previaOrden.map((p, i) => (
                    <div key={`${p.nombre}-${i}`} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 tabular-nums w-5">{i + 1}</span>
                        <span className="truncate">{p.nombre}</span>
                      </span>
                      {p.estado === 'ok' && <span className="text-xs text-green-700 shrink-0">coincide</span>}
                      {p.estado === 'duplicado' && <span className="text-xs text-amber-700 shrink-0">duplicado</span>}
                      {p.estado === 'no_encontrado' && <span className="text-xs text-red-600 shrink-0">no encontrado</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setOrdenModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarOrdenPegado}
                disabled={ordenando || previaOrden.filter((p) => p.estado === 'ok').length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
              >
                {ordenando && <Loader2 className="w-4 h-4 animate-spin" />}
                Aplicar orden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#003087]/10">
                  <FlaskConical className="w-5 h-5 text-[#003087]" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingLaboratorio ? 'Editar Laboratorio' : 'Nuevo Laboratorio'}
                </h2>
              </div>
              <button type="button" onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingLaboratorio ? 'Guardar Cambios' : 'Crear Laboratorio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Eliminar Laboratorio</h3>
                <p className="text-sm text-gray-500 mt-1">
                  ¿Está seguro que desea eliminar <strong>{deleteConfirm.nombre}</strong>? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
