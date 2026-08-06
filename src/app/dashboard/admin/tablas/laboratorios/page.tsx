'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, FlaskConical } from 'lucide-react'
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
          <p className="text-sm text-gray-500 mt-1">Administra los laboratorios del sistema</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo Laboratorio
        </button>
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
                <th className="text-left px-6 py-3 font-semibold text-gray-600">ID</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((lab) => (
                <tr key={lab.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 text-gray-500">{lab.id}</td>
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
