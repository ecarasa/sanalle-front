'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, Tags, GripVertical, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface Categoria { categoria: string; label: string; total: number }
interface Entidad {
  id: number
  categoria: string
  nombre: string
  codigo: string | null
  orden: number
  activo: boolean
}

type FormState = { categoria: string; nombre: string; codigo: string; orden: number; activo: boolean }
const empty: FormState = { categoria: '', nombre: '', codigo: '', orden: 0, activo: true }

export default function EntidadesPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [items, setItems] = useState<Entidad[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Entidad | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)

  const fetchCategorias = useCallback(async (keep?: string) => {
    setLoadingCats(true)
    try {
      const res = await api.get<Categoria[]>('/entidades/categorias')
      setCategorias(res.data)
      setSelected((prev) => keep || prev || (res.data[0]?.categoria ?? null))
    } catch {
      toast.error('No se pudieron cargar las categorías')
    } finally {
      setLoadingCats(false)
    }
  }, [])

  const fetchItems = useCallback(async (categoria: string) => {
    setLoadingItems(true)
    try {
      const res = await api.get<{ items: Entidad[] }>('/entidades', { params: { categoria } })
      setItems(res.data.items)
    } catch {
      toast.error('No se pudieron cargar los valores')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => { fetchCategorias() }, [fetchCategorias])
  useEffect(() => { if (selected) fetchItems(selected) }, [selected, fetchItems])

  const abrirNuevo = (categoriaNueva = false) => {
    setEditing(null)
    setForm({ ...empty, categoria: categoriaNueva ? '' : (selected || ''), orden: (items.length + 1) })
    setModalOpen(true)
  }
  const abrirEditar = (e: Entidad) => {
    setEditing(e)
    setForm({ categoria: e.categoria, nombre: e.nombre, codigo: e.codigo || '', orden: e.orden, activo: e.activo })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.categoria.trim()) { toast.error('Elegí o escribí una categoría'); return }
    if (!form.nombre.trim()) { toast.error('Poné un nombre'); return }
    setSaving(true)
    try {
      const payload = { ...form, categoria: form.categoria.trim(), nombre: form.nombre.trim(), codigo: form.codigo.trim() || null }
      if (editing) await api.put(`/entidades/${editing.id}`, payload)
      else await api.post('/entidades', payload)
      toast.success(editing ? 'Valor actualizado' : 'Valor agregado')
      setModalOpen(false)
      const cat = form.categoria.trim()
      await fetchCategorias(cat)
      if (cat === selected) fetchItems(cat)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (e: Entidad) => {
    if (!confirm(`¿Eliminar "${e.nombre}"?`)) return
    try {
      await api.delete(`/entidades/${e.id}`)
      toast.success('Valor eliminado')
      await fetchCategorias(selected || undefined)
      if (selected) fetchItems(selected)
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  const toggleActivo = async (e: Entidad) => {
    // Optimista.
    setItems((prev) => prev.map((x) => (x.id === e.id ? { ...x, activo: !x.activo } : x)))
    try {
      await api.put(`/entidades/${e.id}`, { activo: !e.activo })
    } catch {
      setItems((prev) => prev.map((x) => (x.id === e.id ? { ...x, activo: e.activo } : x)))
      toast.error('No se pudo cambiar el estado')
    }
  }

  const catActual = categorias.find((c) => c.categoria === selected)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-1.5 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entidades / Combos</h1>
          <p className="text-sm text-gray-500">Los valores de los desplegables de la app, en un solo lugar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Categorías */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Tags className="w-4 h-4 text-[#003087]" />
            <span className="text-sm font-semibold text-gray-700">Categorías</span>
          </div>
          {loadingCats ? (
            <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin text-[#003087]" /></div>
          ) : (
            <div className="p-2">
              {categorias.map((c) => (
                <button
                  key={c.categoria}
                  onClick={() => setSelected(c.categoria)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selected === c.categoria ? 'bg-[#003087]/10 text-[#003087] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selected === c.categoria ? 'bg-[#003087] text-white' : 'bg-gray-100 text-gray-500'}`}>{c.total}</span>
                </button>
              ))}
              <button
                onClick={() => abrirNuevo(true)}
                className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#003087] hover:bg-[#003087]/5 font-medium"
              >
                <Plus className="w-4 h-4" /> Nueva categoría
              </button>
            </div>
          )}
        </div>

        {/* Valores de la categoría */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-700">{catActual?.label || 'Valores'}</span>
            {selected && (
              <button
                onClick={() => abrirNuevo(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            )}
          </div>

          {loadingItems ? (
            <div className="flex items-center justify-center py-14 text-gray-400"><Loader2 className="w-7 h-7 animate-spin text-[#003087]" /></div>
          ) : !selected ? (
            <div className="py-14 text-center text-sm text-gray-400">Elegí una categoría.</div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">Sin valores todavía. Agregá el primero.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((e) => (
                <div key={e.id} className={`flex items-center gap-3 px-4 py-2.5 ${!e.activo ? 'opacity-50' : ''}`}>
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="w-8 text-xs text-gray-400 tabular-nums">{e.orden}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{e.nombre}</span>
                    {e.codigo && <span className="ml-2 text-[11px] font-mono text-gray-400">{e.codigo}</span>}
                  </div>
                  <button
                    onClick={() => toggleActivo(e)}
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${e.activo ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                    title="Activar / desactivar"
                  >
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => abrirEditar(e)} className="p-1.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => eliminar(e)} className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Editar valor' : 'Nuevo valor'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  disabled={!!editing}
                  placeholder="ej: transporte, condicion_pago"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Lo que ve el usuario en el combo"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="ej: oca"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input
                    type="number"
                    value={form.orden}
                    onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer pt-1">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20" />
                Activo (aparece en el combo)
              </label>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
