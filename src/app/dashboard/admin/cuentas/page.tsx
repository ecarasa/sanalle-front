'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Plus, Pencil, Star, Trash2, X, Loader2, Landmark, Banknote, Smartphone, TrendingUp, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

interface CuentaMovimiento {
  fecha: string
  tipo: 'ingreso' | 'egreso'
  importe: number
  descripcion: string
  numero: string | null
}

interface Cuenta {
  id: number
  nombre: string
  tipo: string
  banco: string | null
  numero_cuenta: string | null
  titular: string | null
  cbu: string | null
  alias: string | null
  es_default: boolean
  activo: boolean
  balance: number
  ultimos_movimientos: CuentaMovimiento[]
}

const TIPO_OPTIONS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'banco', label: 'Banco' },
  { value: 'billetera', label: 'Billetera virtual' },
  { value: 'otro', label: 'Otro' },
]

const tipoIcon = (tipo: string) =>
  tipo === 'efectivo' ? <Banknote className="w-5 h-5" /> : tipo === 'billetera' ? <Smartphone className="w-5 h-5" /> : <Landmark className="w-5 h-5" />

type FormState = {
  nombre: string; tipo: string; banco: string; numero_cuenta: string; titular: string; cbu: string; alias: string; es_default: boolean
}
const emptyForm: FormState = { nombre: '', tipo: 'banco', banco: '', numero_cuenta: '', titular: '', cbu: '', alias: '', es_default: false }

export default function CuentasPage() {
  const router = useRouter()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cuenta | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchCuentas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<Cuenta[]>('/cuentas')
      setCuentas(res.data)
    } catch {
      toast.error('Error al cargar cuentas')
    } finally {
      setLoading(false)
    }
  }, [])

  // Lo que suman las cuentas de abajo. Antes acá se mostraba el balance del
  // "libro de caja" (`cuenta_sanalle`), que se alimenta por otro camino y no está
  // atado a ninguna cuenta: la tarjeta decía millones mientras las cuentas
  // sumaban unos pocos miles.
  const sumaCuentas = cuentas.reduce((acc, c) => acc + (c.balance ?? 0), 0)

  useEffect(() => { fetchCuentas() }, [fetchCuentas])

  const openNew = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (c: Cuenta) => {
    setEditing(c)
    setForm({ nombre: c.nombre, tipo: c.tipo, banco: c.banco || '', numero_cuenta: c.numero_cuenta || '', titular: c.titular || '', cbu: c.cbu || '', alias: c.alias || '', es_default: c.es_default })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('Poné un nombre'); return }
    setSaving(true)
    try {
      const payload = { ...form, banco: form.banco || null, numero_cuenta: form.numero_cuenta || null, titular: form.titular || null, cbu: form.cbu || null, alias: form.alias || null }
      if (editing) await api.put(`/cuentas/${editing.id}`, payload)
      else await api.post('/cuentas', payload)
      toast.success(editing ? 'Cuenta actualizada' : 'Cuenta creada')
      setModalOpen(false)
      fetchCuentas()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const marcarDefault = async (c: Cuenta) => {
    try { await api.post(`/cuentas/${c.id}/set-default`); fetchCuentas() }
    catch { toast.error('No se pudo marcar como default') }
  }

  const eliminar = async (c: Cuenta) => {
    if (!confirm(`¿Desactivar la cuenta "${c.nombre}"?`)) return
    try { await api.delete(`/cuentas/${c.id}`); toast.success('Cuenta desactivada'); fetchCuentas() }
    catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'No se pudo eliminar')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-1.5 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuentas</h1>
            <p className="text-sm text-gray-500">Cajas, bancos y billeteras. Los cobros se asocian a una cuenta.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nueva cuenta
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-[#003087] to-[#00AEEF] p-5 text-white shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/15">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Total en cuentas</p>
            <p className="text-[11px] text-white/60">Suma de los saldos de las cuentas de abajo</p>
          </div>
        </div>
        <div className="text-2xl font-black">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatCurrency(sumaCuentas)}
        </div>
      </div>



      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin text-[#003087]" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cuentas.map((c) => (
            <div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${c.es_default ? 'border-[#003087]/30 ring-1 ring-[#003087]/10' : 'border-gray-100'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${c.es_default ? 'bg-[#003087]/10 text-[#003087]' : 'bg-gray-100 text-gray-500'}`}>{tipoIcon(c.tipo)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{c.nombre}</span>
                    {c.es_default && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#003087] text-white">Default</span>}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 capitalize">{c.tipo}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {c.banco && <p>{c.banco}{c.numero_cuenta ? ` · ${c.numero_cuenta}` : ''}</p>}
                    {c.alias && <p>Alias: {c.alias}</p>}
                    {c.cbu && <p>CBU: {c.cbu}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance</p>
                  <p className={`text-lg font-black ${c.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(c.balance)}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Últimos movimientos</p>
                  <button
                    onClick={() => router.push(`/dashboard/transacciones?cuenta_id=${c.id}&cuenta_nombre=${encodeURIComponent(c.nombre)}`)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#003087] hover:underline"
                  >
                    Ver todas <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                {c.ultimos_movimientos.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1">Sin movimientos todavía</p>
                ) : (
                  <ul className="space-y-1">
                    {c.ultimos_movimientos.map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 min-w-0 text-gray-600">
                          {m.tipo === 'ingreso'
                            ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                          <span className="truncate">{m.descripcion}</span>
                          <span className="text-gray-400 shrink-0">· {formatDate(m.fecha)}</span>
                        </span>
                        <span className={`font-semibold shrink-0 ${m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.importe)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-50">
                {!c.es_default && (
                  <button onClick={() => marcarDefault(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100" title="Marcar como default">
                    <Star className="w-3.5 h-3.5" /> Default
                  </button>
                )}
                <button onClick={() => openEdit(c)} className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200" title="Editar"><Pencil className="w-4 h-4" /></button>
                {!c.es_default && (
                  <button onClick={() => eliminar(c)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100" title="Desactivar"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-5 h-5 text-[#003087]" /> {editing ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" placeholder="Ej: Santander, Caja, Mercado Pago" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003087]/20">
                    {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° cuenta</label>
                  <input value={form.numero_cuenta} onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
                  <input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
                  <input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CBU</label>
                  <input value={form.cbu} onChange={(e) => setForm({ ...form, cbu: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]" />
                </div>
              </div>
              {!editing && (
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer pt-1">
                  <input type="checkbox" checked={form.es_default} onChange={(e) => setForm({ ...form, es_default: e.target.checked })} className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20" />
                  Marcar como cuenta por defecto
                </label>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
