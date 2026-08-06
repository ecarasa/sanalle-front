'use client'

import { useState } from 'react'
import { X, Loader2, Save, ArrowUpCircle, ArrowDownCircle, DollarSign, FileText, Tag, Calendar, CreditCard } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface CuentaSanalleModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function CuentaSanalleModal({ open, onClose, onSaved }: CuentaSanalleModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().slice(0, 16),
    tipo: 'egreso',
    categoria: 'gasto_general',
    importe: 0,
    metodo_pago: 'efectivo',
    descripcion: '',
    referencia_id: '',
  })

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.importe <= 0) {
      toast.error('El importe debe ser mayor a 0')
      return
    }

    setLoading(true)
    try {
      await api.post('/cuenta-sanalle', formData)
      toast.success('Movimiento registrado correctamente')
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al registrar movimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${formData.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {formData.tipo === 'ingreso' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Nuevo Movimiento</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Manual - Libro Mayor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipo: 'ingreso' })}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${formData.tipo === 'ingreso'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-100 text-gray-400 hover:border-gray-200'
                }`}
            >
              <ArrowUpCircle className="w-8 h-8" />
              <span className="text-sm font-black uppercase">Ingreso</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipo: 'egreso' })}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${formData.tipo === 'egreso'
                ? 'border-rose-500 bg-rose-50 text-rose-700'
                : 'border-gray-100 text-gray-400 hover:border-gray-200'
                }`}
            >
              <ArrowDownCircle className="w-8 h-8" />
              <span className="text-sm font-black uppercase">Egreso</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Importe</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.importe || ''}
                  onChange={(e) => setFormData({ ...formData, importe: parseFloat(e.target.value) })}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-2xl font-black text-gray-900 focus:border-[#003087] focus:bg-white transition-all outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Categoría</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-[#003087] transition-all"
                  >
                    <option value="gasto_general">Gasto General</option>
                    <option value="sueldo">Sueldo</option>
                    <option value="impuesto">Impuesto</option>
                    <option value="ajuste">Ajuste</option>
                    <option value="ingreso_extraordinario">Ingreso Extraordinario</option>
                    <option value="transferencia_recibida">Transferencia Recibida</option>
                    <option value="cheque_recibido">Cheque Recibido</option>
                    <option value="compra_mercaderia">Compra Mercadería</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Método</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.metodo_pago}
                    onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-[#003087] transition-all"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Fecha y Hora</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-[#003087] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Descripción</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-[#003087] transition-all min-h-[100px]"
                  placeholder="Detalle del movimiento..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-sm font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] inline-flex items-center justify-center gap-2 py-4 text-sm font-black text-white bg-[#003087] rounded-2xl hover:bg-[#002570] shadow-xl shadow-[#003087]/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              REGISTRAR MOVIMIENTO
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
