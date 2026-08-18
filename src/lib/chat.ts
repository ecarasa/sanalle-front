import axios from 'axios'

// El chat vive en un server aparte (WebSockets). URLs por env; fallback a local.
const CHAT_HTTP = process.env.NEXT_PUBLIC_CHAT_HTTP_URL || 'http://localhost:8282'
const CHAT_WS = process.env.NEXT_PUBLIC_CHAT_WS_URL || 'ws://localhost:8282/ws'

// Cliente REST del chat (historial, conversaciones, usuarios), con el mismo JWT.
export const chatApi = axios.create({ baseURL: `${CHAT_HTTP}/chat` })
chatApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ChatEvent {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

/**
 * Conexión WebSocket al chat con:
 *  - auth por query param (?token=),
 *  - heartbeat (ping) cada 25s,
 *  - reconexión automática con backoff,
 *  - suscripción a eventos y a cambios de estado (online/offline).
 */
export class ChatSocket {
  private ws: WebSocket | null = null
  private handlers = new Set<(e: ChatEvent) => void>()
  private statusHandlers = new Set<(online: boolean) => void>()
  private closedByUser = false
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private backoff = 1000

  connect() {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('access_token')
    if (!token) return
    this.closedByUser = false
    try {
      this.ws = new WebSocket(`${CHAT_WS}?token=${encodeURIComponent(token)}`)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.backoff = 1000
      this.emitStatus(true)
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 25000)
    }
    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ChatEvent
        this.handlers.forEach((h) => h(data))
      } catch {
        /* ignorar frames no-JSON */
      }
    }
    this.ws.onclose = () => {
      this.clearPing()
      this.emitStatus(false)
      if (!this.closedByUser) this.scheduleReconnect()
    }
    this.ws.onerror = () => { this.ws?.close() }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.backoff = Math.min(this.backoff * 1.6, 15000)
      this.connect()
    }, this.backoff)
  }

  private clearPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
  }

  private emitStatus(online: boolean) {
    this.statusHandlers.forEach((h) => h(online))
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  send(obj: ChatEvent): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
      return true
    }
    return false
  }

  on(handler: (e: ChatEvent) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  onStatus(handler: (online: boolean) => void) {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  close() {
    this.closedByUser = true
    this.clearPing()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.ws?.close()
    this.ws = null
  }
}
