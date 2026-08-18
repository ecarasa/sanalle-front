'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Send, Plus, Users, User, X, Loader2, MessageSquare, Search, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { chatApi, ChatSocket, ChatEvent } from '@/lib/chat'

interface Conversacion {
  id: number
  tipo: 'individual' | 'grupo'
  titulo: string
  participantes: { id: number; nombre: string }[]
  ultimo_mensaje: string | null
  ultimo_mensaje_fecha: string | null
  no_leidos: number
}

interface Mensaje {
  id: number
  autor_id: number
  autor_nombre: string
  contenido: string
  created_at: string
  propio: boolean
  pending?: boolean   // optimista: aún no confirmado por el server
}

interface UsuarioChat {
  id: number
  nombre: string
  rol: string
}

function horaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function ChatPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [usuarios, setUsuarios] = useState<UsuarioChat[]>([])
  const [modoNuevo, setModoNuevo] = useState<'individual' | 'grupo'>('individual')
  const [grupoNombre, setGrupoNombre] = useState('')
  const [grupoSeleccion, setGrupoSeleccion] = useState<number[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [busquedaUsuarios, setBusquedaUsuarios] = useState('')
  const [online, setOnline] = useState(false)
  const [myId, setMyId] = useState<number | null>(null)
  const [typing, setTyping] = useState<{ convId: number; nombre: string } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<number | null>(null)
  selectedRef.current = selected
  const myIdRef = useRef<number | null>(null)
  const socketRef = useRef<ChatSocket | null>(null)
  const tempIdRef = useRef(-1)
  const typingSentRef = useRef(0)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadConversaciones = useCallback(async () => {
    try {
      const res = await chatApi.get<Conversacion[]>('/conversaciones')
      setConversaciones(res.data)
    } catch {
      /* silencioso */
    }
  }, [])
  const loadConversacionesRef = useRef(loadConversaciones)
  loadConversacionesRef.current = loadConversaciones

  // Refleja un mensaje entrante en la lista de conversaciones (últ. mensaje, orden, no-leídos).
  const aplicarEnLista = useCallback((convId: number, msg: Mensaje) => {
    setConversaciones((prev) => {
      const idx = prev.findIndex((c) => c.id === convId)
      if (idx < 0) {
        // Conversación nueva/desconocida → recargar la lista.
        loadConversacionesRef.current()
        return prev
      }
      const abierta = selectedRef.current === convId
      const suma = !abierta && !msg.propio ? 1 : 0
      const actualizada: Conversacion = {
        ...prev[idx],
        ultimo_mensaje: msg.contenido,
        ultimo_mensaje_fecha: msg.created_at,
        no_leidos: (prev[idx].no_leidos || 0) + suma,
      }
      const resto = prev.filter((_, i) => i !== idx)
      return [actualizada, ...resto]
    })
  }, [])

  // Mensaje entrante por WS.
  const onMensaje = useCallback((convId: number, msg: Mensaje) => {
    if (selectedRef.current === convId) {
      setMensajes((prev) => {
        // Reconciliar con el optimista pendiente (mismo contenido, propio).
        if (msg.propio) {
          const i = prev.findIndex((m) => m.pending && m.contenido === msg.contenido)
          if (i >= 0) {
            const copy = [...prev]
            copy[i] = msg
            return copy
          }
        }
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      // Estoy mirando la conversación → marcar leído.
      socketRef.current?.send({ type: 'leer', conversacion_id: convId })
    }
    aplicarEnLista(convId, msg)
  }, [aplicarEnLista])

  // --- WebSocket: conectar una vez ---
  useEffect(() => {
    const sock = new ChatSocket()
    socketRef.current = sock
    const offStatus = sock.onStatus(setOnline)
    const off = sock.on((e: ChatEvent) => {
      switch (e.type) {
        case 'conectado':
          setMyId(e.user_id)
          myIdRef.current = e.user_id
          break
        case 'mensaje':
          onMensaje(e.conversacion_id, e.mensaje as Mensaje)
          break
        case 'typing':
          if (e.autor_id !== myIdRef.current) {
            setTyping({ convId: e.conversacion_id, nombre: e.autor_nombre })
            if (typingClearRef.current) clearTimeout(typingClearRef.current)
            typingClearRef.current = setTimeout(() => setTyping(null), 3500)
          }
          break
        // 'no_leidos' (total global) y 'leido' (recibo de lectura) disponibles si se quieren usar.
        default:
          break
      }
    })
    sock.connect()
    return () => {
      off()
      offStatus()
      sock.close()
      if (typingClearRef.current) clearTimeout(typingClearRef.current)
    }
  }, [onMensaje])

  // Carga inicial + red de seguridad liviana (por si se pierde algún evento).
  useEffect(() => {
    loadConversaciones()
    const t = setInterval(loadConversaciones, 20000)
    return () => clearInterval(t)
  }, [loadConversaciones])

  const marcarLeido = useCallback((convId: number) => {
    setConversaciones((prev) => prev.map((c) => (c.id === convId ? { ...c, no_leidos: 0 } : c)))
    if (!socketRef.current?.send({ type: 'leer', conversacion_id: convId })) {
      chatApi.post(`/conversaciones/${convId}/leer`).catch(() => {})
    }
  }, [])

  const abrirConversacion = useCallback(async (convId: number) => {
    setSelected(convId)
    setMensajes([])
    setTyping(null)
    try {
      const res = await chatApi.get<Mensaje[]>(`/conversaciones/${convId}/mensajes`)
      setMensajes(res.data)
      marcarLeido(convId)
    } catch {
      toast.error('No se pudieron cargar los mensajes')
    }
  }, [marcarLeido])

  // Auto-scroll al final cuando llegan mensajes o alguien escribe.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes, typing])

  // Envío OPTIMISTA: se muestra al toque; el WS confirma (o REST de fallback).
  const enviar = useCallback(() => {
    const contenido = texto.trim()
    if (!contenido || selected === null) return
    const nowIso = new Date().toISOString()
    const temp: Mensaje = {
      id: tempIdRef.current--,
      autor_id: myIdRef.current ?? -1,
      autor_nombre: 'Yo',
      contenido,
      created_at: nowIso,
      propio: true,
      pending: true,
    }
    setMensajes((prev) => [...prev, temp])
    aplicarEnLista(selected, temp)
    setTexto('')

    const enviado = socketRef.current?.send({ type: 'enviar', conversacion_id: selected, contenido })
    if (!enviado) {
      // Fallback REST si el socket no está abierto.
      chatApi.post<Mensaje>(`/conversaciones/${selected}/mensajes`, { contenido })
        .then((res) => {
          setMensajes((prev) => {
            const i = prev.findIndex((m) => m.pending && m.contenido === contenido)
            if (i >= 0) { const c = [...prev]; c[i] = res.data; return c }
            return prev
          })
        })
        .catch(() => toast.error('No se pudo enviar el mensaje'))
    }
  }, [texto, selected, aplicarEnLista])

  // Indicador de "escribiendo" (throttle 2s).
  const onTyping = useCallback(() => {
    if (selected === null) return
    const now = Date.now()
    if (now - typingSentRef.current > 2000) {
      typingSentRef.current = now
      socketRef.current?.send({ type: 'typing', conversacion_id: selected })
    }
  }, [selected])

  const abrirNuevo = async () => {
    setNuevoOpen(true)
    setModoNuevo('individual')
    setGrupoNombre('')
    setGrupoSeleccion([])
    setBusquedaUsuarios('')
    try {
      const res = await chatApi.get<UsuarioChat[]>('/usuarios')
      setUsuarios(res.data)
    } catch {
      toast.error('No se pudieron cargar los usuarios')
    }
  }

  const crearIndividual = async (userId: number) => {
    try {
      const res = await chatApi.post<{ id: number }>('/conversaciones', { tipo: 'individual', user_id: userId })
      setNuevoOpen(false)
      await loadConversaciones()
      abrirConversacion(res.data.id)
    } catch {
      toast.error('No se pudo crear el chat')
    }
  }

  const crearGrupo = async () => {
    if (!grupoNombre.trim() || grupoSeleccion.length === 0) {
      toast.error('Poné un nombre y elegí al menos un participante')
      return
    }
    try {
      const res = await chatApi.post<{ id: number }>('/conversaciones', {
        tipo: 'grupo',
        nombre: grupoNombre.trim(),
        participante_ids: grupoSeleccion,
      })
      setNuevoOpen(false)
      await loadConversaciones()
      abrirConversacion(res.data.id)
    } catch {
      toast.error('No se pudo crear el grupo')
    }
  }

  const conversacionActiva = conversaciones.find((c) => c.id === selected)

  // Filtrado en memoria (instantáneo).
  const conversacionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return conversaciones
    return conversaciones.filter((c) =>
      c.titulo.toLowerCase().includes(q) || (c.ultimo_mensaje || '').toLowerCase().includes(q)
    )
  }, [conversaciones, busqueda])

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuarios.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.rol.toLowerCase().includes(q))
  }, [usuarios, busquedaUsuarios])

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#003087] rounded-lg">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Chat interno</h1>
        <span
          className={`ml-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${online ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}
          title={online ? 'Conectado en tiempo real' : 'Reconectando…'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {online ? 'En vivo' : 'Reconectando…'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[420px]">
        {/* Lista de conversaciones */}
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden ${selected !== null ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Conversaciones</span>
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>
          <div className="px-3 py-2 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {conversacionesFiltradas.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                {busqueda ? 'Sin resultados.' : 'Sin conversaciones todavía.'}
              </div>
            ) : (
              conversacionesFiltradas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => abrirConversacion(c.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected === c.id ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${c.tipo === 'grupo' ? 'bg-purple-100 text-purple-600' : 'bg-[#003087]/10 text-[#003087]'}`}>
                      {c.tipo === 'grupo' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800 truncate">{c.titulo}</span>
                        {c.no_leidos > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-[#E31837] text-white rounded-full flex items-center justify-center">
                            {c.no_leidos}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{c.ultimo_mensaje || 'Sin mensajes'}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Panel de mensajes */}
        <div className={`md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden ${selected === null ? 'hidden md:flex' : 'flex'}`}>
          {selected === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-sm">Elegí una conversación o creá una nueva.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <button type="button" onClick={() => setSelected(null)} className="md:hidden p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${conversacionActiva?.tipo === 'grupo' ? 'bg-purple-100 text-purple-600' : 'bg-[#003087]/10 text-[#003087]'}`}>
                  {conversacionActiva?.tipo === 'grupo' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{conversacionActiva?.titulo}</p>
                  {typing && typing.convId === selected ? (
                    <p className="text-[11px] text-[#00AEEF] font-medium">{typing.nombre} está escribiendo…</p>
                  ) : conversacionActiva?.tipo === 'grupo' ? (
                    <p className="text-[11px] text-gray-400">{conversacionActiva.participantes.map((p) => p.nombre).join(', ')}</p>
                  ) : null}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/40">
                {mensajes.map((m) => (
                  <div key={m.id} className={`flex ${m.propio ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${m.propio ? 'bg-[#003087] text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'} ${m.pending ? 'opacity-70' : ''}`}>
                      {!m.propio && conversacionActiva?.tipo === 'grupo' && (
                        <p className="text-[10px] font-bold text-[#00AEEF] mb-0.5">{m.autor_nombre}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{m.contenido}</p>
                      <p className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${m.propio ? 'text-white/60' : 'text-gray-400'}`}>
                        {horaCorta(m.created_at)}
                        {m.propio && (m.pending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 border-t border-gray-100">
                <input
                  type="text"
                  value={texto}
                  onChange={(e) => { setTexto(e.target.value); onTyping() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder="Escribí un mensaje..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
                <button
                  type="button"
                  onClick={enviar}
                  disabled={!texto.trim()}
                  className="p-2.5 bg-[#003087] text-white rounded-lg hover:bg-[#002570] disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nuevo chat */}
      {nuevoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setNuevoOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nueva conversación</h2>
              <button type="button" onClick={() => setNuevoOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex gap-2 px-5 pt-4">
              <button
                type="button"
                onClick={() => setModoNuevo('individual')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${modoNuevo === 'individual' ? 'border-[#003087] bg-[#003087]/5 text-[#003087]' : 'border-gray-200 text-gray-600'}`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => setModoNuevo('grupo')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${modoNuevo === 'grupo' ? 'border-[#003087] bg-[#003087]/5 text-[#003087]' : 'border-gray-200 text-gray-600'}`}
              >
                Grupo
              </button>
            </div>

            <div className="px-5 pt-3">
              {modoNuevo === 'grupo' && (
                <input
                  type="text"
                  value={grupoNombre}
                  onChange={(e) => setGrupoNombre(e.target.value)}
                  placeholder="Nombre del grupo"
                  className="w-full px-3 py-2 mb-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={busquedaUsuarios}
                  onChange={(e) => setBusquedaUsuarios(e.target.value)}
                  placeholder="Buscar usuario…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pt-3 space-y-2">
              {usuariosFiltrados.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">{usuarios.length === 0 ? 'No hay otros usuarios.' : 'Sin resultados.'}</p>
              ) : (
                usuariosFiltrados.map((u) => (
                  modoNuevo === 'individual' ? (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => crearIndividual(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#003087]/10 text-[#003087] flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.nombre}</p>
                        <p className="text-[11px] text-gray-400 capitalize">{u.rol}</p>
                      </div>
                    </button>
                  ) : (
                    <label key={u.id} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={grupoSeleccion.includes(u.id)}
                        onChange={(e) => setGrupoSeleccion((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))}
                        className="w-4 h-4 text-[#003087] border-gray-300 rounded focus:ring-[#003087]/20"
                      />
                      <span className="text-sm text-gray-800">{u.nombre}</span>
                    </label>
                  )
                ))
              )}
            </div>

            {modoNuevo === 'grupo' && (
              <div className="px-5 py-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={crearGrupo}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002570] transition-colors"
                >
                  Crear grupo {grupoSeleccion.length > 0 && `(${grupoSeleccion.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
