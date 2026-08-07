'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, Building2, Phone, Mail, MapPin,
  Calendar, CreditCard, ChevronDown, ChevronUp, Banknote, AlertCircle,
  CheckCircle2, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import DataGrid from '@/components/grilla/DataGrid'
import { Proveedor, PaginatedResponse, PagoDeudaProveedorResponse } from '@/types'
import ProveedorModal from '@/components/admin/ProveedorModal'

// ---------------------------------------------------------------------------
// PagoProveedorPanel
// ---------------------------------------------------------------------------

function PagoProveedorPanel({
  proveedor,
  onPagado,
}: {
  proveedor: Proveedor
  onPagado: () => void
}) {
  const pagos = proveedor.pagos_pendientes ?? []
  const descuento = Number(proveedor.descuento)
  const cashbackPct = Number(proveedor.cashback)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [montosParciales, setMontosParciales] = useState<Record<number, string>>({})
  const [descCheck, setDescCheck] = useState(false)
  const [cashbackCheck, setCashbackCheck] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [paying, setPaying] = useState(false)

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true)
    try {
      const res = await api.get<{ total: number }>('/cuenta-sanalle/balance_neto')
      setBalance(res.data.total)
    } catch {
      setBalance(null)
    } finally {
      setLoadingBalance(false)
    }
  }, [])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  const descPct = descCheck ? descuento : 0

  const calcMaxMonto = (saldo: number) => saldo * (1 - descPct / 100)

  const toggleAll = () => {
    if (selected.size === pagos.length) {
      setSelected(new Set())
      setMontosParciales({})
    } else {
      const ids = new Set(pagos.map(p => p.id))
      setSelected(ids)
      const montos: Record<number, string> = {}
      pagos.forEach(p => { montos[p.id] = calcMaxMonto(Number(p.saldo_pendiente)).toFixed(2) })
      setMontosParciales(montos)
    }
  }

  const toggle = (id: number) => {
    const nextSelected = new Set(selected)
    const nextMontos = { ...montosParciales }
    if (nextSelected.has(id)) {
      nextSelected.delete(id)
      delete nextMontos[id]
    } else {
      nextSelected.add(id)
      const pago = pagos.find(p => p.id === id)
      if (pago) nextMontos[id] = calcMaxMonto(Number(pago.saldo_pendiente)).toFixed(2)
    }
    setSelected(nextSelected)
    setMontosParciales(nextMontos)
  }

  // When discounts change, reset partial amounts for all selected rows
  useEffect(() => {
    if (selected.size === 0) return
    const montos: Record<number, string> = {}
    pagos.forEach(p => {
      if (selected.has(p.id)) montos[p.id] = calcMaxMonto(Number(p.saldo_pendiente)).toFixed(2)
    })
    setMontosParciales(montos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descCheck])

  const selectedPagos = pagos.filter(p => selected.has(p.id))
  const total = selectedPagos.reduce((sum, p) => {
    return sum + parseFloat(montosParciales[p.id] || '0')
  }, 0)



  const handlePagar = async () => {
    setPaying(true)
    try {
      const res = await api.post<PagoDeudaProveedorResponse>(
        `/proveedores/${proveedor.id}/pagar`,
        {
          ingresos: selectedPagos.map(p => ({
            id: p.id,
            monto: parseFloat(montosParciales[p.id] || '0'),
          })),
          metodo_pago: metodoPago,
          aplicar_descuento: descCheck,
          aplicar_cashback: cashbackCheck,
        }
      )
      const cashbackMsg = res.data.cashback_importe > 0
        ? ` · NC crédito ${formatCurrency(res.data.cashback_importe)}`
        : ''
      toast.success(`Pago de ${formatCurrency(res.data.total_pagado)} registrado${cashbackMsg}`)
      setShowConfirm(false)
      setSelected(new Set())
      setMontosParciales({})
      await fetchBalance()
      onPagado()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  if (!pagos.length) {
    return (
      <p className="text-xs text-gray-400 italic flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        Sin comprobantes pendientes
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.size === pagos.length && pagos.length > 0}
              onChange={toggleAll}
              className="rounded border-gray-300 text-[#003087] focus:ring-[#003087]"
            />
            Seleccionar todos
          </label>

          {descuento > 0 && (
            <label className="flex items-center gap-1.5 text-xs font-bold text-teal-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={descCheck}
                onChange={e => setDescCheck(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Descuento ({descuento}%)
            </label>
          )}
          {cashbackPct > 0 && (
            <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cashbackCheck}
                onChange={e => setCashbackCheck(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              Cashback ({cashbackPct}%)
            </label>
          )}

          <select
            value={metodoPago}
            onChange={e => setMetodoPago(e.target.value)}
            className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-[#003087] focus:border-[#003087] outline-none"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>

        {/* Balance badge */}
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Wallet className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">Balance Sanalle:</span>
          {loadingBalance ? (
            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
          ) : balance === null ? (
            <span className="text-gray-400">—</span>
          ) : (
            <span className={balance > 0 ? 'text-emerald-600' : 'text-red-600'}>
              {formatCurrency(balance)}
            </span>
          )}
        </div>
      </div>

      {/* Payments list */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
          <div className="col-span-1"></div>
          <div className="col-span-3">Comprobante</div>
          <div className="col-span-2 text-center">Fecha</div>
          <div className="col-span-2 text-right">Saldo Pendiente</div>
          <div className="col-span-2 text-center">Descuento</div>
          <div className="col-span-2 text-right">A Pagar</div>
        </div>

        {pagos.map(p => {
          const saldo = Number(p.saldo_pendiente)
          const maxMonto = calcMaxMonto(saldo)
          const isSelected = selected.has(p.id)
          const montoStr = montosParciales[p.id] ?? maxMonto.toFixed(2)
          const montoVal = parseFloat(montoStr) || 0
          const isPartial = isSelected && montoVal < maxMonto - 0.005

          return (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-[#003087]/5' : 'hover:bg-white'
                }`}
            >
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(p.id)}
                  onClick={e => e.stopPropagation()}
                  className="rounded border-gray-300 text-[#003087] focus:ring-[#003087]"
                />
              </div>
              <div className="col-span-3 flex flex-col">
                <span className="text-xs font-bold text-gray-800">{p.numero}</span>
                <span className="text-[10px] text-gray-400">{p.numero_comprobante}</span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-xs text-gray-500">{new Date(p.fecha).toLocaleDateString()}</span>
                {p.fecha_vencimiento && (
                  <span className="block text-[9px] text-orange-500">Vto: {new Date(p.fecha_vencimiento).toLocaleDateString()}</span>
                )}
              </div>
              <div className="col-span-2 text-right">
                <span className={`text-xs font-semibold ${descPct > 0 ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {formatCurrency(saldo)}
                </span>
              </div>
              <div className="col-span-2 text-center">
                {descPct > 0 ? (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-100">
                    -{descPct}%
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>
              <div className="col-span-2 text-right" onClick={e => e.stopPropagation()}>
                {isSelected ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <input
                      type="number"
                      min={0.01}
                      max={maxMonto}
                      step={0.01}
                      value={montoStr}
                      onChange={e => {
                        const val = e.target.value
                        setMontosParciales(prev => ({ ...prev, [p.id]: val }))
                      }}
                      onBlur={e => {
                        let val = parseFloat(e.target.value)
                        if (isNaN(val) || val <= 0) val = 0.01
                        if (val > maxMonto) val = maxMonto
                        setMontosParciales(prev => ({ ...prev, [p.id]: val.toFixed(2) }))
                      }}
                      className="w-24 text-right text-sm font-black text-[#003087] bg-white border border-[#003087]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#003087]"
                    />
                    {isPartial && (
                      <span className="text-[9px] text-orange-500 font-bold">Parcial</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm font-black text-gray-400">{formatCurrency(maxMonto)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 border bg-[#003087]/5 border-[#003087]/15`}>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-gray-600">
              {selected.size} comprobante{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
              {selectedPagos.some(p => parseFloat(montosParciales[p.id] || '0') < calcMaxMonto(Number(p.saldo_pendiente)) - 0.005) && (
                <span className="ml-2 text-orange-500"> · pago parcial</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black text-[#003087]">{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowConfirm(true)}

            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#003087] rounded-xl hover:bg-[#002570] transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Banknote className="w-4 h-4" />
            Pagar
          </button>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-[#003087] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl">
                  <Banknote className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Confirmar Pago</h2>
                  <p className="text-xs text-white/70 font-medium">{proveedor.nombre}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary rows */}
              <div className="space-y-2">
                {selectedPagos.map(p => {
                  const saldo = Number(p.saldo_pendiente)
                  const maxMonto = calcMaxMonto(saldo)
                  const monto = parseFloat(montosParciales[p.id] || maxMonto.toFixed(2))
                  const isPartial = monto < maxMonto - 0.005
                  return (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">{p.numero}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">{p.numero_comprobante}</span>
                          {isPartial && (
                            <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1 rounded">parcial</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {descPct > 0 && (
                          <span className="block text-[10px] text-gray-400 line-through">
                            {formatCurrency(saldo)}
                          </span>
                        )}
                        <span className="font-bold text-[#003087]">{formatCurrency(monto)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                {descCheck && descuento > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Descuento aplicado</span>
                    <span className="font-bold text-teal-600">-{descuento}%</span>
                  </div>
                )}
                {cashbackCheck && cashbackPct > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cashback generado</span>
                    <span className="font-bold text-emerald-600">+{formatCurrency(total * cashbackPct / 100)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Método de pago</span>
                  <span className="font-bold text-gray-700 capitalize">{metodoPago}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-black text-gray-900">Total a pagar</span>
                  <span className="text-2xl font-black text-[#003087]">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Balance info */}
              <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center justify-between text-sm border border-emerald-100">
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <Wallet className="w-4 h-4" />
                  Balance disponible
                </span>
                <span className="font-black text-emerald-700">{formatCurrency(balance ?? 0)}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={paying}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-colors border border-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePagar}
                  disabled={paying}
                  className="flex-[2] inline-flex items-center justify-center gap-2 py-3 text-sm font-black text-white bg-[#003087] rounded-2xl hover:bg-[#002570] shadow-lg shadow-[#003087]/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {paying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  CONFIRMAR PAGO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Filas expandibles (panel de pago/deuda a proveedores + notas) desactivadas por
// ahora para que el listado quede como los demás. Poner en true para revivirlas.
// Ver docs/OCULTO_PARA_REVIVIR.md
const PROVEEDOR_EXPAND_ENABLED = false

export default function AdminProveedoresPage() {
  useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<Proveedor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<Proveedor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const fetchProveedores = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedResponse<Proveedor>>('/proveedores', {
        params: { page, page_size: pageSize, search: debouncedSearch, include_inactive: includeInactive }
      })
      setData(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, pageSize, includeInactive])

  useEffect(() => { fetchProveedores() }, [fetchProveedores])

  const openCreate = () => { setEditingProveedor(null); setModalOpen(true) }
  const openEdit = (p: Proveedor) => { setEditingProveedor(p); setModalOpen(true) }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await api.delete(`/proveedores/${deleteConfirm.id}`)
      toast.success('Proveedor desactivado correctamente')
      setDeleteConfirm(null)
      fetchProveedores()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al desactivar proveedor')
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo(() => [
    ...(PROVEEDOR_EXPAND_ENABLED ? [{
      key: 'expand',
      label: '',
      sortable: false,
      width: '40px',
      render: (_: any, row: Proveedor) => (
        <button
          onClick={e => { e.stopPropagation(); setExpandedRow(expandedRow === row.id ? null : row.id) }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          {expandedRow === row.id
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
      ),
    }] : []),
    {
      key: 'nombre',
      label: 'Proveedor',
      sortable: true,
      render: (value: string, row: Proveedor) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{value}</span>
          <span className="text-[10px] text-gray-400 uppercase font-black">{row.tipo}</span>
        </div>
      ),
    },
    {
      key: 'contacto',
      label: 'Contacto',
      render: (_: any, row: Proveedor) => (
        <div className="space-y-0.5">
          {row.contacto_nombre && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Building2 className="w-3 h-3 text-gray-400" /><span>{row.contacto_nombre}</span>
            </div>
          )}
          {row.telefono && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Phone className="w-3 h-3 text-gray-400" /><span>{row.telefono}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'plazo_pago',
      label: 'Plazo',
      width: '80px',
      render: (value: number) => (
        <div className="flex flex-col items-center">
          <Calendar className="w-3.5 h-3.5 text-gray-400 mb-0.5" />
          <span className="text-xs font-bold text-gray-700">{value}d</span>
        </div>
      ),
    },
    /* --- OCULTO (revivir): columna Saldo Pendiente (deuda con el proveedor). Ver docs/OCULTO_PARA_REVIVIR.md ---
    {
      key: 'saldo_pendiente_total',
      label: 'Saldo Pendiente',
      sortable: true,
      render: (value: number) => (
        <div className="flex flex-col items-end">
          <span className={`text-sm font-bold ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(value)}
          </span>
          {value > 0 && <span className="text-[9px] text-gray-400">Deuda Corriente</span>}
        </div>
      ),
    },
    --- FIN OCULTO --- */
    {
      key: 'activo',
      label: 'Estado',
      width: '100px',
      render: (value: boolean) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      stickyRight: true,
      width: '100px',
      render: (_: any, row: Proveedor) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm(row)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Desactivar"
            disabled={!row.activo}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], [expandedRow])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-b from-[#00AEEF] to-[#003087]" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Proveedores</h1>
              <p className="mt-0.5 text-sm text-gray-500">Gestión de laboratorios y droguerías</p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Proveedor
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={e => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300 text-[#003087] focus:ring-[#003087]"
          />
          Mostrar inactivos
        </label>
      </div>

      <DataGrid
        columns={columns}
        data={data}
        isLoading={loading}
        totalRows={total}
        page={page}
        pageSize={pageSize}
        searchValue={search}
        onSearch={setSearch}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchPlaceholder="Buscar proveedor por nombre..."
        renderCustomRow={PROVEEDOR_EXPAND_ENABLED ? ((row: Proveedor) =>
          expandedRow === row.id ? (
            <tr key={`expanded-${row.id}`} className="bg-gray-50/50">
              <td colSpan={columns.length} className="px-6 py-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                  {/* Info column */}
                  <div className="md:col-span-4 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase">Información de Contacto</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                        <span className="text-sm text-gray-600">{row.direccion || 'Sin dirección'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                        <span className="text-sm text-gray-600">{row.contacto_email || 'Sin email'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                        <span className="text-sm text-gray-600">{row.contacto_telefono || 'Sin teléfono'}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mt-8">
                      <p className="text-xs font-bold text-gray-400 uppercase">Condiciones Comerciales</p>
                      <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-2 shadow-sm">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Descuento:</span>
                          <span className="font-bold text-teal-600">{row.descuento}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Cashback:</span>
                          <span className="font-bold text-emerald-600">{row.cashback}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Notas credito */}
                    {(row.notas ?? []).length > 0 && (
                      <div className="space-y-2 mt-6">
                        <p className="text-xs font-bold text-gray-400 uppercase flex items-center justify-between">
                          <span>Notas de Crédito</span>
                          {(row.total_notas_credito ?? 0) > 0 && (
                            <span className="normal-case font-bold text-emerald-600">
                              {formatCurrency(row.total_notas_credito ?? 0)}
                            </span>
                          )}
                        </p>
                        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                          {(row.notas ?? []).map(n => (
                            <div key={n.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0 text-xs">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-700">{n.numero}</span>
                                <span className="text-gray-400">{new Date(n.fecha).toLocaleDateString()}</span>
                              </div>
                              <span className={`font-bold ${n.tipo === 'credito' ? 'text-emerald-600' : 'text-red-500'}`}>
                                {n.tipo === 'credito' ? '+' : '-'}{formatCurrency(n.importe_total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment panel */}
                  <div className="md:col-span-8">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-3">
                      Estado de Cuenta
                      {(row.saldo_pendiente_total ?? 0) > 0 && (
                        <span className="ml-2 normal-case font-normal text-red-500">
                          — Deuda total: {formatCurrency(row.saldo_pendiente_total ?? 0)}
                        </span>
                      )}
                    </p>
                    <PagoProveedorPanel proveedor={row} onPagado={fetchProveedores} />
                  </div>

                </div>
              </td>
            </tr>
          ) : null
        ) : undefined}
      />

      <ProveedorModal
        open={modalOpen}
        editingProveedor={editingProveedor}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); fetchProveedores() }}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Desactivar Proveedor</h3>
                <p className="text-sm text-gray-500 mt-1">
                  ¿Está seguro que desea desactivar a <strong>{deleteConfirm.nombre}</strong>?
                  Ya no aparecerá en las listas de selección.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
