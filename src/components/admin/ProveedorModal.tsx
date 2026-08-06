'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, Building2, Phone, Mail, MapPin, Calendar, Percent } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Proveedor } from '@/types'

interface ProveedorModalProps {
  open: boolean
  editingProveedor: Proveedor | null
  onClose: () => void
  onSaved: () => void
}

export default function ProveedorModal({ open, editingProveedor, onClose, onSaved }: ProveedorModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    tipo: 'LABORATORIO',
    plazo_pago: 30,
    deuda_inicial: 0,
    contacto_nombre: '',
    contacto_telefono: '',
    contacto_email: '',
    descuento: 0,
    cashback: 0,
    activo: true,
  })

  useEffect(() => {
    if (editingProveedor) {
      setFormData({
        nombre: editingProveedor.nombre || '',
        telefono: editingProveedor.telefono || '',
        direccion: editingProveedor.direccion || '',
        tipo: editingProveedor.tipo || 'LABORATORIO',
        plazo_pago: editingProveedor.plazo_pago || 30,
        deuda_inicial: Number(editingProveedor.deuda_inicial) || 0,
        contacto_nombre: editingProveedor.contacto_nombre || '',
        contacto_telefono: editingProveedor.contacto_telefono || '',
        contacto_email: editingProveedor.contacto_email || '',
        descuento: Number(editingProveedor.descuento) || 0,
        cashback: Number(editingProveedor.cashback) || 0,
        activo: editingProveedor.activo,
      })
    } else {
      setFormData({
        nombre: '',
        telefono: '',
        direccion: '',
        tipo: 'LABORATORIO',
        plazo_pago: 30,
        deuda_inicial: 0,
        contacto_nombre: '',
        contacto_telefono: '',
        contacto_email: '',
        descuento: 0,
        cashback: 0,
        activo: true,
      })
    }
  }, [editingProveedor, open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (editingProveedor) {
        await api.put(`/proveedores/${editingProveedor.id}`, formData)
        toast.success('Proveedor actualizado correctamente')
      } else {
        await api.post('/proveedores', formData)
        toast.success('Proveedor creado correctamente')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al guardar proveedor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#003087]/10">
              <Building2 className="w-5 h-5 text-[#003087]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#003087] uppercase tracking-wider">Datos Principales</h3>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre / Razón Social</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-all"
                  placeholder="Ej: Laboratorio Sanalle"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                  >
                    <option value="LABORATORIO">Laboratorio</option>
                    <option value="DROGUERIA">Droguería</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Plazo Pago (Días)</label>
                  <input
                    type="number"
                    value={formData.plazo_pago}
                    onChange={(e) => setFormData({ ...formData, plazo_pago: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Dirección comercial"
                  />
                </div>
              </div>

              {editingProveedor && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded text-[#003087]"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">Proveedor Activo</label>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#003087] uppercase tracking-wider">Contacto</h3>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de Contacto</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.contacto_nombre}
                    onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Nombre del vendedor/representante"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Teléfono fijo o celular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.contacto_email}
                  onChange={(e) => setFormData({ ...formData, contacto_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email@ejemplo.com"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Commercial Conditions */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#003087] uppercase tracking-wider flex items-center gap-2">
              <Percent className="w-4 h-4" /> Condiciones Comerciales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descuento (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={formData.descuento}
                  onChange={(e) => setFormData({ ...formData, descuento: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cashback (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={formData.cashback}
                  onChange={(e) => setFormData({ ...formData, cashback: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deuda Inicial ($)</label>
                <input
                  type="number"
                  value={formData.deuda_inicial}
                  onChange={(e) => setFormData({ ...formData, deuda_inicial: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-bold text-gray-900"
                  disabled={!!editingProveedor}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-2 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] shadow-lg shadow-[#003087]/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingProveedor ? 'Guardar Cambios' : 'Crear Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
