'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal, ModalOverlay, Dialog, Heading } from 'react-aria-components'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import DataGrid from '@/components/grilla/DataGrid'
import { PaginatedResponse } from '@/types'

interface ABMField {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  required?: boolean
  options?: { label: string; value: string }[]
  optionsEndpoint?: string
  optionsLabelKey?: string
  optionsValueKey?: string
  disabled?: boolean | ((isEditing: boolean) => boolean)
  maxLength?: number
  step?: string
}

interface GenericABMColumn {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
}

interface GenericABMProps {
  title: string
  subtitle: string
  endpoint: string
  columns: GenericABMColumn[]
  fields: ABMField[]
  pkField?: string
  entityLabel: string
  searchPlaceholder?: string
  storageKey: string
  defaultPageSize?: number
}

export default function GenericABM({
  title,
  subtitle,
  endpoint,
  columns,
  fields,
  pkField = 'id',
  entityLabel,
  searchPlaceholder = 'Buscar...',
  storageKey,
  defaultPageSize = 10,
}: GenericABMProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)

  // Dynamic options fetched from API for select fields with optionsEndpoint
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, { label: string; value: string }[]>>({})

  // Fetch dynamic options on mount
  useEffect(() => {
    const fieldsWithEndpoint = fields.filter((f) => f.optionsEndpoint)
    fieldsWithEndpoint.forEach(async (field) => {
      try {
        const res = await api.get(field.optionsEndpoint!)
        const items = res.data.items ?? res.data
        const labelKey = field.optionsLabelKey || 'nombre'
        const valueKey = field.optionsValueKey || 'id'
        const opts = items.map((item: any) => ({
          label: String(item[labelKey]),
          value: String(item[valueKey]),
        }))
        setDynamicOptions((prev) => ({ ...prev, [field.key]: opts }))
      } catch {
        // silent - options will be empty
      }
    })
  }, [fields])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<any>>(endpoint, {
        params: { page, page_size: pageSize, search: debouncedSearch || undefined },
      })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [endpoint, page, pageSize, debouncedSearch])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const openCreateModal = () => {
    setEditingItem(null)
    const emptyForm: Record<string, string> = {}
    fields.forEach((f) => {
      emptyForm[f.key] = ''
    })
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (item: any) => {
    setEditingItem(item)
    const prefilled: Record<string, string> = {}
    fields.forEach((f) => {
      prefilled[f.key] = String(item[f.key] ?? '')
    })
    setForm(prefilled)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Build payload, converting number fields
      const payload: Record<string, any> = {}
      fields.forEach((f) => {
        const val = form[f.key]
        if (f.type === 'number' && val !== '') {
          payload[f.key] = Number(val)
        } else {
          payload[f.key] = val === '' ? null : val
        }
      })

      if (editingItem) {
        await api.put(`${endpoint}/${editingItem[pkField]}`, payload)
        toast.success(`${entityLabel} actualizado`)
      } else {
        await api.post(endpoint, payload)
        toast.success(`${entityLabel} creado`)
      }
      closeModal()
      fetchData()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast.error(detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.delete(`${endpoint}/${deleting[pkField]}`)
      toast.success(`${entityLabel} eliminado`)
      setDeleting(null)
      fetchData()
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('No se puede eliminar: existen registros asociados')
      } else {
        const detail = err?.response?.data?.detail
        toast.error(detail || 'Error al eliminar')
      }
      setDeleting(null)
    }
  }

  const isFieldDisabled = (field: ABMField): boolean => {
    if (field.disabled === undefined) return false
    if (typeof field.disabled === 'function') return field.disabled(!!editingItem)
    return field.disabled
  }

  const getFieldOptions = (field: ABMField): { label: string; value: string }[] => {
    if (field.options) return field.options
    if (field.optionsEndpoint && dynamicOptions[field.key]) return dynamicOptions[field.key]
    return []
  }

  // Append actions column
  const columnsWithActions = useMemo(() => {
    const actionsCol: GenericABMColumn = {
      key: '__actions',
      label: 'Acciones',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openEditModal(row)
            }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-[#003087] hover:bg-[#003087]/10 transition-colors"
            title="Editar"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(row)
            }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    }
    return [...columns, actionsCol]
  }, [columns])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-[#003087] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#002060] flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Nuevo {entityLabel}
        </button>
      </div>

      {/* DataGrid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <DataGrid
          columns={columnsWithActions}
          data={data}
          isLoading={loading}
          totalRows={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder={searchPlaceholder}
          storageKey={storageKey}
        />
      </div>

      {/* Create/Edit Modal */}
      <ModalOverlay
        isOpen={showModal}
        onOpenChange={(open) => { if (!open) closeModal() }}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      >
        <Modal className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto outline-none">
          <Dialog className="outline-none">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <Heading slot="title" className="text-lg font-semibold text-gray-900">
                {editingItem ? `Editar ${entityLabel}` : `Nuevo ${entityLabel}`}
              </Heading>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {fields.map((field) => {
                const disabled = isFieldDisabled(field)
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        value={form[field.key] || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        required={field.required}
                        disabled={disabled}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Seleccionar...</option>
                        {getFieldOptions(field).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={form[field.key] || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        required={field.required}
                        disabled={disabled}
                        maxLength={field.maxLength}
                        step={field.step}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    )}
                  </div>
                )
              })}

              <div className="flex items-center justify-end gap-3 pt-2">
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
                  className="px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002060] disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingItem ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Delete Confirm Modal */}
      <ModalOverlay
        isOpen={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      >
        <Modal className="relative bg-white rounded-xl shadow-xl w-full max-w-sm outline-none">
          <Dialog className="outline-none">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <Heading slot="title" className="text-lg font-semibold text-gray-900 mb-2">
                Eliminar {entityLabel}
              </Heading>
              <p className="text-sm text-gray-500 mb-6">
                ¿Eliminar este registro? Esta acción no se puede deshacer.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleting(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  )
}

export type { ABMField, GenericABMColumn, GenericABMProps }
