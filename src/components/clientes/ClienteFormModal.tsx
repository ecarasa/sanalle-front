'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal, ModalOverlay, Dialog, Heading } from 'react-aria-components'
import api from '@/lib/api'
import { GRUPO_OPTIONS } from '@/lib/listas'
import { ClienteConDeuda, Zona } from '@/types'
import { CreatableSelect } from '@/components/ui/CreatableSelect'

interface Localidad {
  id: number
  nombre: string
}


interface ClienteForm {
  nombre: string
  razon_social: string
  cuit: string
  domicilio: string
  telefono: string
  whatsapp: string
  email: string
  tipo: string
  zona_id: string
  condicion_pago: string
  plazo_dias: string
  localidad_id: string
  vendedor_id: string
  comentarios: string
  deuda_inicial_remito: string
  deuda_inicial_factura: string
}

const emptyForm: ClienteForm = {
  nombre: '',
  razon_social: '',
  cuit: '',
  domicilio: '',
  telefono: '',
  whatsapp: '',
  email: '',
  tipo: '',
  zona_id: '',
  condicion_pago: '',
  plazo_dias: '',
  localidad_id: '',
  vendedor_id: '',
  comentarios: '',
  deuda_inicial_remito: '0',
  deuda_inicial_factura: '0',
}

interface ClienteFormModalProps {
  open: boolean
  onClose: () => void
  editingCliente?: ClienteConDeuda | null
  localidades: Localidad[]
  onSuccess: () => void
  isAdmin?: boolean
}

export default function ClienteFormModal({
  open,
  onClose,
  editingCliente = null,
  localidades,
  onSuccess,
  isAdmin = false,
}: ClienteFormModalProps) {
  const [form, setForm] = useState<ClienteForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [localLocalidades, setLocalLocalidades] = useState<Localidad[]>([])
  const [localZonas, setLocalZonas] = useState<Zona[]>([])
  const [vendedores, setVendedores] = useState<{ id: number; nombre_completo: string }[]>([])

  useEffect(() => {
    setLocalLocalidades(localidades)
  }, [localidades])

  useEffect(() => {
    if (isAdmin && open) {
      api.get('/users/vendedores')
        .then(res => setVendedores(res.data))
        .catch(() => toast.error('Error al cargar vendedores'))
    }
    if (open) {
      api.get('/zonas')
        .then(res => setLocalZonas(res.data.items || []))
        .catch(() => console.error('Error al cargar zonas'))
    }
  }, [isAdmin, open])

  useEffect(() => {
    if (!open) return
    if (editingCliente) {
      setForm({
        nombre: editingCliente.nombre,
        razon_social: editingCliente.razon_social || '',
        cuit: editingCliente.cuit || '',
        domicilio: editingCliente.domicilio,
        telefono: editingCliente.telefono || '',
        whatsapp: editingCliente.whatsapp || '',
        email: editingCliente.email || '',
        tipo: editingCliente.tipo || '',
        zona_id: editingCliente.zona_id != null ? String(editingCliente.zona_id) : '',
        condicion_pago: editingCliente.condicion_pago || '',
        plazo_dias: editingCliente.plazo_dias != null ? String(editingCliente.plazo_dias) : '',
        localidad_id: editingCliente.localidad_id != null ? String(editingCliente.localidad_id) : '',
        vendedor_id: editingCliente.vendedor_id != null ? String(editingCliente.vendedor_id) : '',
        comentarios: editingCliente.comentarios || '',
        deuda_inicial_remito: String(editingCliente.deuda_inicial_remito || 0),
        deuda_inicial_factura: String(editingCliente.deuda_inicial_factura || 0),
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, editingCliente])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.domicilio.trim() || !form.localidad_id) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre,
        razon_social: form.razon_social || null,
        cuit: form.cuit || null,
        domicilio: form.domicilio,
        telefono: form.telefono || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        tipo: form.tipo || null,
        zona_id: form.zona_id ? parseInt(form.zona_id) : null,
        condicion_pago: form.condicion_pago || null,
        plazo_dias: form.plazo_dias ? parseInt(form.plazo_dias) : null,
        localidad_id: form.localidad_id ? parseInt(form.localidad_id) : null,
        vendedor_id: form.vendedor_id && isAdmin ? parseInt(form.vendedor_id) : null,
        comentarios: form.comentarios || null,
        deuda_inicial_remito: parseFloat(form.deuda_inicial_remito) || 0,
        deuda_inicial_factura: parseFloat(form.deuda_inicial_factura) || 0,
      }

      if (editingCliente) {
        await api.put(`/clientes/${editingCliente.id}`, payload)
        toast.success('Cliente actualizado correctamente')
      } else {
        await api.post('/clientes', payload)
        toast.success('Cliente creado correctamente')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Error al guardar cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose() }}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    >
      <Modal className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto outline-none">
        <Dialog className="outline-none">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#003087]/10">
                <Users className="w-5 h-5 text-[#003087]" />
              </div>
              <Heading slot="title" className="text-lg font-bold text-gray-900">
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </Heading>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razon Social</label>
              <input
                type="text"
                value={form.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
              <input
                type="text"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domicilio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.domicilio}
                onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                required
              />
            </div>



            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
                >
                  <option value="">-- Sin definir --</option>
                  {GRUPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <CreatableSelect
                  options={localZonas.map((z) => ({ value: String(z.id), label: z.nombre }))}
                  value={form.zona_id}
                  onChange={(val) => setForm({ ...form, zona_id: String(val) })}
                  onCreate={async (inputValue) => {
                    try {
                      const res = await api.post('/zonas', { nombre: inputValue })
                      const newZona = res.data
                      setLocalZonas((prev) => [...prev, newZona])
                      return String(newZona.id)
                    } catch (err: any) {
                      toast.error(err?.response?.data?.detail || 'Error al crear zona')
                      throw err
                    }
                  }}
                  placeholder="Seleccione Zona"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condición de Pago</label>
                <select
                  value={form.condicion_pago}
                  onChange={(e) => setForm({ ...form, condicion_pago: e.target.value, plazo_dias: e.target.value === 'contado' ? '' : form.plazo_dias })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
                >
                  <option value="">-- Sin definir --</option>
                  <option value="contado">Contado</option>
                  <option value="plazo">Plazo</option>
                </select>
              </div>
              {form.condicion_pago === 'plazo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plazo (días)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.plazo_dias}
                    onChange={(e) => setForm({ ...form, plazo_dias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                    placeholder="Ej: 30"
                  />
                </div>
              )}
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localidad <span className="text-red-500">*</span>
                </label>
                <CreatableSelect
                  options={localLocalidades.map((loc) => ({ value: String(loc.id), label: loc.nombre }))}
                  value={form.localidad_id}
                  onChange={(val) => setForm({ ...form, localidad_id: String(val) })}
                  onCreate={async (inputValue) => {
                    try {
                      const res = await api.post('/localidades', { nombre: inputValue })
                      const newLoc = res.data
                      setLocalLocalidades((prev) => [...prev, newLoc])
                      return String(newLoc.id)
                    } catch (err: any) {
                      toast.error(err?.response?.data?.detail || 'Error al crear localidad')
                      throw err
                    }
                  }}
                  placeholder="Seleccione Localidad"
                  required
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor Asignado</label>
                <select
                  value={form.vendedor_id}
                  onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white"
                >
                  <option value="">-- Sin asignar --</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.nombre_completo}</option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">D. Inicial Remitos</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.deuda_inicial_remito}
                    onChange={(e) => setForm({ ...form, deuda_inicial_remito: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">D. Inicial Facturas</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.deuda_inicial_factura}
                    onChange={(e) => setForm({ ...form, deuda_inicial_factura: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
              <textarea
                value={form.comentarios}
                onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] resize-none"
                placeholder="Comentarios sobre el cliente..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
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
                {editingCliente ? 'Guardar Cambios' : 'Crear Cliente'}
              </button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
