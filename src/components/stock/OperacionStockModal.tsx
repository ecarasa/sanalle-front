'use client'

import { useEffect, useState } from 'react'
import { ArrowUpDown, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { Deposito, MotivoAjuste, Producto } from '@/types'

type Operacion = 'ajuste' | 'fijar' | 'transferir'

interface Props {
  producto: Producto
  depositos: Deposito[]
  /** Qué operaciones puede hacer quien abrió el modal. */
  operaciones?: Operacion[]
  /** Depósito preseleccionado (ej. si se clickeó su celda en la grilla). */
  depositoInicial?: number | null
  onClose: () => void
  /** Se llama después de aplicar, para que la pantalla refresque. */
  onDone: () => void
}

const LABEL: Record<Operacion, string> = {
  ajuste: 'Ajuste (+/-)',
  fijar: 'Fijar cantidad',
  transferir: 'Transferir',
}

/**
 * Operación de stock sobre un producto.
 *
 * Vive en `components/stock` y no dentro de una pantalla porque lo usan tanto
 * Stock como Gestión de Productos: tenerlo duplicado garantizaba que en dos
 * meses uno pidiera motivo y el otro no.
 */
export default function OperacionStockModal({
  producto,
  depositos,
  operaciones = ['ajuste', 'fijar', 'transferir'],
  depositoInicial = null,
  onClose,
  onDone,
}: Props) {
  const [op, setOp] = useState<Operacion>(operaciones[0])
  const [depositoId, setDepositoId] = useState<number | null>(null)
  const [destinoId, setDestinoId] = useState<number | null>(null)
  const [cajas, setCajas] = useState('')
  const [blisters, setBlisters] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [motivos, setMotivos] = useState<MotivoAjuste[]>([])
  const [guardando, setGuardando] = useState(false)

  // Arranca en el depósito que se clickeó o, si no, en el que ya tiene stock:
  // es el que casi siempre se quiere tocar, y evita cargar sobre uno vacío.
  useEffect(() => {
    const conStock = producto.stocks?.find((st) => st.cajas > 0 || st.blisters > 0)
    setDepositoId(depositoInicial ?? conStock?.deposito_id ?? depositos[0]?.id ?? null)
  }, [producto, depositoInicial, depositos])

  useEffect(() => {
    api.get<MotivoAjuste[]>('/stock/motivos-ajuste')
      .then((res) => setMotivos(res.data))
      .catch(() => setMotivos([]))
  }, [])

  const filaActual = producto.stocks?.find((st) => st.deposito_id === depositoId)

  const aplicar = async () => {
    if (!depositoId) return
    const nCajas = parseInt(cajas, 10) || 0
    const nBlisters = parseInt(blisters, 10) || 0

    setGuardando(true)
    try {
      if (op === 'transferir') {
        await api.post(`/productos/${producto.id}/operacion-stock`, {
          tipo_operacion: 'TRANSFER',
          deposito_id: depositoId,
          deposito_destino_id: destinoId,
          cantidad_cajas: nCajas,
          cantidad_blisters: nBlisters,
          observacion: observacion || 'Transferencia entre depósitos',
        })
      } else {
        const res = await api.post('/stock/ajustes', {
          producto_id: producto.id,
          deposito_id: depositoId,
          modo: op === 'fijar' ? 'absoluto' : 'delta',
          cantidad_cajas: nCajas,
          cantidad_blisters: nBlisters,
          motivo,
          observacion: observacion || null,
        })
        if (res.data?.sin_cambio) {
          toast('El stock ya estaba en ese valor: no se registró ningún movimiento')
          onClose()
          return
        }
      }
      toast.success('Operación registrada')
      onDone()
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } }
      const detalle = error.response?.data?.detail
      toast.error(typeof detalle === 'string' ? detalle : 'Error en la operación')
    } finally {
      setGuardando(false)
    }
  }

  const faltaMotivo = op !== 'transferir' && !motivo
  // Con los dos campos vacíos no se envía nada. En "fijar" eso es crítico: vacío
  // se leería como cero y dejaría el depósito sin stock por un click de más.
  const sinCantidad = !cajas && !blisters
  const deshabilitado =
    guardando ||
    !depositoId ||
    faltaMotivo ||
    sinCantidad ||
    (op === 'transferir' && !destinoId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00AEEF]/10">
              <ArrowUpDown className="w-5 h-5 text-[#00AEEF]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Operación de Stock</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          {operaciones.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { setOp(o); setCajas(''); setBlisters('') }}
              className={`flex-1 py-3 text-xs font-bold uppercase transition-colors ${
                op === o ? 'text-[#00AEEF] border-b-2 border-[#00AEEF]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {LABEL[o]}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-sm font-bold text-gray-800">{producto.nombre}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">{producto.codigo}</p>
              <p className="text-xs font-medium text-[#003087]">
                1 caja = {producto.blisters_por_caja || '?'} blísters
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {depositos.map((dep) => {
              const st = producto.stocks?.find((x) => x.deposito_id === dep.id)
              const sel = depositoId === dep.id
              return (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => setDepositoId(dep.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    sel ? 'border-[#00AEEF] bg-[#00AEEF]/5' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase text-gray-400 truncate">{dep.nombre}</p>
                  <p className="text-xs font-bold">{st?.cajas ?? 0} cj + {st?.blisters ?? 0} bl</p>
                  {(st?.reservado_cajas || st?.reservado_blisters) ? (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {st.reservado_cajas} cj + {st.reservado_blisters} bl reservados
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          {op === 'transferir' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Mover hacia</label>
              <select
                value={destinoId ?? ''}
                onChange={(e) => setDestinoId(e.target.value ? Number(e.target.value) : null)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
              >
                <option value="">Elegí el depósito destino</option>
                {depositos.filter((d) => d.id !== depositoId).map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cajas {op === 'ajuste' ? '(+/-)' : op === 'fijar' ? '(cantidad final)' : 'a mover'}
              </label>
              <input
                type="number"
                min={op === 'ajuste' ? undefined : 0}
                value={cajas}
                onChange={(e) => setCajas(e.target.value)}
                placeholder={op === 'fijar' ? String(filaActual?.cajas ?? 0) : '0'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Blísters {op === 'ajuste' ? '(+/-)' : op === 'fijar' ? '(cantidad final)' : 'a mover'}
              </label>
              <input
                type="number"
                min={op === 'ajuste' ? undefined : 0}
                value={blisters}
                onChange={(e) => setBlisters(e.target.value)}
                placeholder={op === 'fijar' ? String(filaActual?.blisters ?? 0) : '0'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-bold"
              />
            </div>
          </div>

          {op !== 'transferir' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Motivo <span className="text-red-500">*</span>
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Elegí por qué se corrige</option>
                {motivos.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observación</label>
            <input
              type="text"
              value={observacion}
              maxLength={200}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Opcional: el detalle que no entra en el motivo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {op === 'fijar' && (
            <p className="text-[10px] text-gray-500 italic text-center">
              Deja el stock del depósito en la cantidad indicada, sin importar cuánto había.
              Es lo que se usa después de contar físicamente. Un campo vacío cuenta como cero:
              escribí las dos cantidades.
            </p>
          )}
          {op === 'ajuste' && (
            <p className="text-[10px] text-red-500 italic text-center">
              Suma o resta sobre lo que ya hay. Usá números negativos para descontar.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={deshabilitado}
              className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-[#00AEEF] rounded-xl hover:bg-[#0098d4] shadow-lg shadow-[#00AEEF]/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              {op === 'transferir' ? 'Confirmar transferencia' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
