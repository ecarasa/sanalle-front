'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Link2, Copy, RefreshCw, ExternalLink, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface LinkPublico {
  grupo: string
  label: string
  token: string
}

const GRUPO_COLOR: Record<string, string> = {
  minorista: 'from-slate-500 to-slate-700',
  mayorista: 'from-[#00AEEF] to-[#003087]',
  comercio: 'from-amber-500 to-orange-600',
}

export default function ListasPublicasModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [links, setLinks] = useState<LinkPublico[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerando, setRegenerando] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urlDe = (token: string) => `${origin}/lista/${token}`

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ links: LinkPublico[] }>('/publico/admin/links')
      setLinks(res.data.links)
    } catch {
      toast.error('No se pudieron cargar los links')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open) fetchLinks() }, [open, fetchLinks])

  const copiar = async (token: string, grupo: string) => {
    try {
      await navigator.clipboard.writeText(urlDe(token))
      setCopiado(grupo)
      setTimeout(() => setCopiado((c) => (c === grupo ? null : c)), 1500)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const regenerar = async (grupo: string) => {
    if (!confirm(`¿Regenerar el link de la lista ${grupo}? El link anterior dejará de funcionar inmediatamente.`)) return
    setRegenerando(grupo)
    try {
      const res = await api.post<LinkPublico>(`/publico/admin/links/${grupo}/regenerar`)
      setLinks((prev) => prev.map((l) => (l.grupo === grupo ? res.data : l)))
      toast.success('Link regenerado. El anterior quedó revocado.')
    } catch {
      toast.error('No se pudo regenerar')
    } finally {
      setRegenerando(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#003087]" /> Listas de precios públicas
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-sm text-gray-500">
            Compartí estos links (sin login) para que vean la lista de precios actualizada de cada grupo.
            Si un link se filtra, regeneralo: el anterior deja de funcionar al instante.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-7 h-7 animate-spin text-[#003087]" /></div>
          ) : (
            <div className="space-y-3">
              {links.map((l) => (
                <div key={l.grupo} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`h-1.5 bg-gradient-to-r ${GRUPO_COLOR[l.grupo] || 'from-gray-400 to-gray-600'}`} />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-gray-900">{l.label}</span>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">/lista</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={urlDe(l.token)}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 min-w-0 px-3 py-2 text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20"
                      />
                      <button
                        onClick={() => copiar(l.token, l.grupo)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#003087] bg-[#003087]/10 rounded-lg hover:bg-[#003087]/20 transition-colors shrink-0"
                        title="Copiar link"
                      >
                        {copiado === l.grupo ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiado === l.grupo ? 'Copiado' : 'Copiar'}
                      </button>
                      <a
                        href={urlDe(l.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors shrink-0"
                        title="Abrir en pestaña nueva"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir
                      </a>
                      <button
                        onClick={() => regenerar(l.grupo)}
                        disabled={regenerando === l.grupo}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors shrink-0 disabled:opacity-50"
                        title="Regenerar (revoca el link anterior)"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regenerando === l.grupo ? 'animate-spin' : ''}`} />
                        Regenerar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
