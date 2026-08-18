'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '@/lib/api'
import { PuntoEntrega, RecorridoActivo } from '@/types'

const DEPOSITO: [number, number] = [-34.596922, -58.497111]
const COLOR_RUTA = '#E31837'

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo_para_despacho: 'Listo Despacho',
  en_camino: 'En Camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

function crearIcono(numero: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background-color:${COLOR_RUTA};border:2px solid white;border-radius:50%;
      width:30px;height:30px;display:flex;align-items:center;justify-content:center;
      color:white;font-weight:bold;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.4);
    ">${numero}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  })
}

const ICONO_DEPOSITO = L.divIcon({
  className: '',
  html: `<div style="
    background-color:#1f2937;border:2px solid white;border-radius:6px;
    width:30px;height:30px;display:flex;align-items:center;justify-content:center;
    color:white;font-size:16px;box-shadow:0 2px 4px rgba(0,0,0,0.5);
  ">🏭</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -18],
})

function FitBounds({ puntos }: { puntos: PuntoEntrega[] }) {
  const map = useMap()
  useEffect(() => {
    const coords: [number, number][] = [
      DEPOSITO,
      ...puntos.map(p => [p.latitud, p.longitud] as [number, number]),
    ]
    if (coords.length > 1) map.fitBounds(coords, { padding: [40, 40] })
  }, [puntos, map])
  return null
}

// Un punto por cliente (promedio de coords si hay más de un pedido en el mismo cliente)
interface ClienteAgrupado {
  cliente_id: number
  cliente: string
  zona: string | null
  latitud: number
  longitud: number
  pedidos: PuntoEntrega[]
}

function agruparPorCliente(puntos: PuntoEntrega[]): ClienteAgrupado[] {
  const map = new Map<number, ClienteAgrupado>()
  for (const p of puntos) {
    if (map.has(p.cliente_id)) {
      map.get(p.cliente_id)!.pedidos.push(p)
    } else {
      map.set(p.cliente_id, {
        cliente_id: p.cliente_id,
        cliente: p.cliente,
        zona: p.zona,
        latitud: p.latitud,
        longitud: p.longitud,
        pedidos: [p],
      })
    }
  }
  return Array.from(map.values())
}

interface CacheRuta {
  hash_id: string
  coords: [number, number][]
  km: number
  tiempo_minutos: number
  tramos: { distancia_km: number, tiempo_minutos: number }[]
}

const LS_KEY = 'recorrido_activo'

function formatHora(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

interface Props {
  fecha: string
}

export default function MapaEntregas({ fecha }: Props) {
  const [puntos, setPuntos] = useState<PuntoEntrega[]>([])
  const [zonaActiva, setZonaActiva] = useState<string | null>(null)
  const [cacheRutas, setCacheRutas] = useState<Record<string, CacheRuta>>({})
  const [routeCargando, setRouteCargando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recorridoActivo, setRecorridoActivo] = useState<RecorridoActivo | null>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [terminandoRecorrido, setTerminandoRecorrido] = useState(false)
  const [despachando, setDespachando] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  // ── Fetch puntos del backend ──────────────────────────────────────────────
  useEffect(() => {
    if (!fecha) return
    setLoading(true)
    setError(null)
    setPuntos([])
    setZonaActiva(null)
    setCacheRutas({})

    // Incluye 'listo_para_despacho' y 'en_camino' (default del backend): permite
    // PLANIFICAR la ruta antes de despachar.
    api.get<PuntoEntrega[]>('/pedidos/rutas_entregas', { params: { fecha } })
      .then(res => setPuntos(res.data))
      .catch(() => setError('No se pudieron cargar las rutas de entrega.'))
      .finally(() => setLoading(false))
  }, [fecha, refreshTick])

  // ── Zonas únicas extraídas de los puntos ─────────────────────────────────
  const zonas = useMemo(() => {
    const set = new Set<string>()
    for (const p of puntos) if (p.zona) set.add(p.zona)
    return Array.from(set).sort()
  }, [puntos])

  // ── Puntos filtrados por zona activa ─────────────────────────────────────
  const puntosFiltrados = useMemo(
    () => (zonaActiva ? puntos.filter(p => p.zona === zonaActiva) : puntos),
    [puntos, zonaActiva]
  )

  // ── Clientes agrupados ────────────────────────────────────────────────────
  const clientesAgrupados = useMemo(
    () => agruparPorCliente(puntosFiltrados),
    [puntosFiltrados]
  )

  // ── Clave de caché para el conjunto visible ───────────────────────────────
  const cacheKey = zonaActiva ?? '__todas__'

  // ── Handlers para Google Maps ─────────────────────────────────────────────
  const handleAbrirGoogleMapsCompleto = () => {
    if (clientesVisibles.length === 0) return

    // Origen: El depósito
    const origin = `${DEPOSITO[0]},${DEPOSITO[1]}`

    // Destino: El último cliente de la ruta
    const ultimoCliente = clientesVisibles[clientesVisibles.length - 1]
    const destination = `${ultimoCliente.latitud},${ultimoCliente.longitud}`

    // Waypoints (Paradas intermedias): Todos menos el último
    // Google Maps usa el pipe '|' para separar paradas
    const waypoints = clientesVisibles
      .slice(0, -1)
      .map(c => `${c.latitud},${c.longitud}`)
      .join('|')

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    if (waypoints) {
      url += `&waypoints=${waypoints}`
    }

    window.open(url, '_blank')
  }

  // ── Llamada OSRM /trip cuando cambia la zona o los puntos ────────────────
  useEffect(() => {
    if (clientesAgrupados.length < 1) return
    if (cacheRutas[cacheKey]) return   // ya calculado

    setRouteCargando(true)

    const coordenadasPayload = [
      { latitud: DEPOSITO[0], longitud: DEPOSITO[1] },
      ...clientesAgrupados.map(c => ({ latitud: c.latitud, longitud: c.longitud }))
    ]

    const pedidosIds = clientesAgrupados.flatMap(c => c.pedidos.map(p => p.pedido_id));

    api.post('/pedidos/optimizar_ruta', { coordenadas: coordenadasPayload, pedidos_ids: pedidosIds, fecha })
      .then(res => {
        const { coords, km, tiempo_minutos, waypoints, tramos } = res.data

        // Reordenar clientes según waypoints original
        const ordered = waypoints
          .slice(1)
          .map((wpIndex: number, i: number) => ({ wpIndex, cliente: clientesAgrupados[i] }))
          .sort((a: any, b: any) => a.wpIndex - b.wpIndex)
          .map((x: any) => x.cliente)

        // Guardamos tanto la ruta como el orden optimizado en el caché
        setCacheRutas(prev => ({ ...prev, [cacheKey]: { hash_id: res.data.hash_id, coords, km, tiempo_minutos, tramos } }))
        // Actualizamos el orden visual de los clientes usando el caché de orden
        setClientesOrdenados(prev => ({ ...prev, [cacheKey]: ordered }))
      })
      .catch(() => { /* falla silenciosa, se usa orden original */ })
      .finally(() => setRouteCargando(false))
  }, [cacheKey, clientesAgrupados, cacheRutas])

  // Orden optimizado por zona (caché separado)
  const [clientesOrdenados, setClientesOrdenados] = useState<Record<string, ClienteAgrupado[]>>({})

  const clientesVisibles = clientesOrdenados[cacheKey] ?? clientesAgrupados
  const rutaActual = cacheRutas[cacheKey]

  // ── Handlers iniciar / terminar recorrido ─────────────────────────────────
  async function handleIniciarRecorrido() {
    if (!rutaActual) return
    const ahora = new Date()
    const horaInicio = ahora.toISOString()

    // Calcular ETAs en el frontend usando la hora local real (evita problemas de timezone servidor)
    let acumulado = 0
    const etas = rutaActual.tramos.map((tramo, i) => {
      acumulado += tramo.tiempo_minutos
      return { parada_index: i, eta_iso: new Date(ahora.getTime() + acumulado * 60000).toISOString() }
    })

    const activo: RecorridoActivo = { hash_id: rutaActual.hash_id, inicio: horaInicio, etas }
    setRecorridoActivo(activo)
    localStorage.setItem(LS_KEY, JSON.stringify(activo))

    // Persistir en backend en segundo plano (no bloqueante)
    api.patch(`/pedidos/rutas/${rutaActual.hash_id}/iniciar`, { hora_inicio: horaInicio, etas }).catch(() => { })
  }

  async function handleTerminarRecorrido() {
    if (!rutaActual || !recorridoActivo) return
    const pedidosIds = puntosFiltrados.map(p => p.pedido_id)
    setTerminandoRecorrido(true)
    try {
      await api.patch(`/pedidos/rutas/${rutaActual.hash_id}/terminar`, { pedidos_ids: pedidosIds })
      localStorage.removeItem(LS_KEY)
      setRecorridoActivo(null)
      setCacheRutas(prev => { const next = { ...prev }; delete next[cacheKey]; return next })
      setPuntos([])
    } catch {
      alert('Error al terminar el recorrido.')
    } finally {
      setTerminandoRecorrido(false)
    }
  }

  // IDs de pedidos de la ruta visible, en el orden óptimo.
  const pedidoIdsRuta = clientesVisibles.flatMap(c => c.pedidos.map(p => p.pedido_id))

  // Despachar la ruta en masa: los 'listo_para_despacho' pasan a 'en_camino'.
  async function handleDespacharRuta() {
    if (pedidoIdsRuta.length === 0) return
    setDespachando(true)
    try {
      const res = await api.post('/pedidos/despachar-ruta', { pedido_ids: pedidoIdsRuta })
      const n = res.data?.despachados ?? 0
      setCacheRutas({})
      setRefreshTick(t => t + 1)
      alert(`${n} pedido(s) despachado(s) (en camino).`)
    } catch {
      alert('Error al despachar la ruta.')
    } finally {
      setDespachando(false)
    }
  }

  // Descargar la hoja de ruta (PDF) con las paradas en el orden óptimo.
  async function handleHojaRuta() {
    if (pedidoIdsRuta.length === 0) return
    try {
      const res = await api.post(
        '/pedidos/hoja-ruta',
        { pedido_ids: pedidoIdsRuta, fecha },
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      alert('No se pudo generar la hoja de ruta.')
    }
  }

  // ── Estados de carga/error ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-xl border">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (puntos.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-xl border">
        <p className="text-gray-500 text-sm">No hay pedidos <strong>en camino</strong> con coordenadas para esta fecha.</p>
      </div>
    )
  }

  const totalPedidos = puntosFiltrados.length
  const totalClientes = clientesVisibles.length

  return (
    <div className="space-y-3">
      {/* ── Filtro de zonas ──────────────────────────────────────────────── */}
      {zonas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Zona:</span>
          <button
            onClick={() => setZonaActiva(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${zonaActiva === null
              ? 'bg-[#003087] text-white border-[#003087]'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
          >
            Todas
          </button>
          {zonas.map(zona => (
            <button
              key={zona}
              onClick={() => setZonaActiva(zona)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${zonaActiva === zona
                ? 'bg-[#003087] text-white border-[#003087]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
            >
              {zona}
            </button>
          ))}
          <div className="flex items-center gap-3 flex-wrap">
            {!recorridoActivo && puntosFiltrados.length > 0 && (
              <button
                onClick={handleIniciarRecorrido}
                disabled={!rutaActual || routeCargando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#003087] text-white text-sm font-bold hover:bg-[#002060] transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {routeCargando ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                  </svg>
                )}
                <span>{routeCargando ? 'Calculando ruta...' : 'Iniciar Recorrido'}</span>
              </button>
            )}
            {recorridoActivo && (
              <>
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-bold shadow-sm ring-1 ring-green-100/50">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span>
                  </span>
                  <span>En curso · salida {formatHora(recorridoActivo.inicio)}</span>
                </div>
                <button
                  onClick={handleTerminarRecorrido}
                  disabled={terminandoRecorrido}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E31837] text-white text-sm font-bold hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:scale-100"
                >
                  {terminandoRecorrido ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <rect width="12" height="12" x="2" y="2" rx="2" />
                    </svg>
                  )}
                  <span>Terminar Recorrido</span>
                </button>
              </>
            )}
          </div>

          {rutaActual && puntosFiltrados.length > 0 && (
            <button
              onClick={handleAbrirGoogleMapsCompleto}
              className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
              title="Abrir ruta completa en Google Maps"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 4c-6.627 0-12 5.373-12 12 0 10.5 12 28 12 28s12-17.5 12-28c0-6.627-5.373-12-12-12zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z"/>
                <path fill="#FBBC05" d="M24 10c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6z"/>
              </svg>
              <span>Abrir en Google Maps</span>
            </button>
          )}

          {/* Hoja de ruta imprimible (orden óptimo de paradas) */}
          {pedidoIdsRuta.length > 0 && (
            <button
              onClick={handleHojaRuta}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm active:scale-[0.98]"
              title="Descargar hoja de ruta (PDF)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5zm0 1h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                <path d="M6 4h4v1H6V4zm0 3h4v1H6V7zm0 3h3v1H6v-1z"/>
              </svg>
              <span>Hoja de ruta</span>
            </button>
          )}

          {/* Despachar la ruta en masa: listo_para_despacho -> en_camino */}
          {puntosFiltrados.some(p => p.estado === 'listo_para_despacho') && (
            <button
              onClick={handleDespacharRuta}
              disabled={despachando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00AEEF] text-white text-sm font-bold hover:bg-[#0093D4] transition-all duration-200 shadow-sm active:scale-[0.98] disabled:opacity-60"
              title="Despachar toda la ruta (pasa a 'en camino')"
            >
              {despachando ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h9A1.5 1.5 0 0 1 12 3.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 1 1-4 0H5a2 2 0 1 1-3.998-.085A1.5 1.5 0 0 1 0 10.5v-7zM12 10a2 2 0 0 1 1.732 1h.768a.5.5 0 0 0 .5-.5V8.35a.5.5 0 0 0-.11-.312l-1.48-1.85A.5.5 0 0 0 13.02 6H12v4zm-9 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                </svg>
              )}
              <span>Despachar ruta</span>
            </button>
          )}

        </div>
      )}

      {/* ── Controles de recorrido ───────────────────────────────────────── */}

      {/* ── Mapa ─────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border shadow-sm" style={{ height: 580, zIndex: 0 }}>
        <MapContainer center={DEPOSITO} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds puntos={puntosFiltrados} />

          {/* Depósito */}
          <Marker position={DEPOSITO} icon={ICONO_DEPOSITO}>
            <Popup>
              <p className="font-semibold text-sm">Depósito</p>
              <p className="text-xs text-gray-500">Punto de partida</p>
            </Popup>
          </Marker>

          {/* Un marcador por cliente */}
          {clientesVisibles.map((c, idx) => (
            <Marker
              key={c.cliente_id}
              position={[c.latitud, c.longitud]}
              icon={crearIcono(idx + 1)}
            >
              <Popup>
                <div className="text-sm min-w-[200px] space-y-2">
                  <div>
                    <div className="flex justify-between items-start">
                      <p className="text-xs text-gray-400">Parada {idx + 1}{c.zona ? ` · ${c.zona}` : ''}</p>
                      <div className="flex items-center gap-1">
                        {recorridoActivo?.etas?.[idx] && (
                          <p className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100 font-semibold">
                            ETA {formatHora(recorridoActivo.etas[idx].eta_iso)}
                          </p>
                        )}
                        {rutaActual?.tramos?.[idx] && (
                          <p className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100" title={`Distancia tramo: ${rutaActual.tramos[idx].distancia_km.toFixed(1)} km`}>
                            +{rutaActual.tramos[idx].tiempo_minutos.toFixed(0)} min
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-base leading-tight mt-1">{c.cliente}</p>
                    {c.pedidos[0]?.direccion_texto && (
                      <p className="text-xs text-gray-500">{c.pedidos[0].direccion_texto}</p>
                    )}
                  </div>
                  <div className="border-t pt-1.5 space-y-1">
                    <p className="text-xs font-semibold text-gray-600">
                      {c.pedidos.length} pedido{c.pedidos.length > 1 ? 's' : ''}
                    </p>
                    {c.pedidos.map(p => (
                      <div key={p.pedido_id} className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium">{p.numero_pedido}</span>
                        <span className="text-xs text-gray-500">{ESTADO_LABEL[p.estado] ?? p.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Ruta OSRM */}
          {rutaActual && (
            <Polyline
              positions={rutaActual.coords}
              pathOptions={{ color: COLOR_RUTA, weight: 4, opacity: 0.75 }}
            />
          )}

          {/* Línea punteada mientras carga */}
          {!rutaActual && clientesVisibles.length >= 1 && (
            <Polyline
              positions={[DEPOSITO, ...clientesVisibles.map(c => [c.latitud, c.longitud] as [number, number])]}
              pathOptions={{ color: COLOR_RUTA, weight: 2, opacity: 0.35, dashArray: '6 6' }}
            />
          )}
        </MapContainer>

        {/* Overlay loader OSRM */}
        {routeCargando && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-1.5 shadow text-xs text-gray-600 font-medium pointer-events-none">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600 flex-shrink-0" />
            Calculando ruta óptima...
          </div>
        )}

        {/* Leyenda */}
        <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-xl shadow-lg border overflow-hidden text-xs" style={{ minWidth: 180 }}>
          <div className="px-3 py-2 bg-gray-50 border-b">
            <p className="font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Resumen</p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Clientes</span>
              <span className="font-semibold text-gray-800">{totalClientes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pedidos</span>
              <span className="font-semibold text-gray-800">{totalPedidos}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Recorrido</span>
              <span className="font-semibold text-gray-800">
                {routeCargando ? (
                  <span className="text-gray-400">calculando...</span>
                ) : rutaActual ? (
                  `${rutaActual.km.toFixed(1)} km`
                ) : (
                  '—'
                )}
              </span>
            </div>
            {rutaActual && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tiempo Est.</span>
                <span className="font-semibold text-gray-800">
                  {rutaActual.tiempo_minutos < 60
                    ? `${rutaActual.tiempo_minutos.toFixed(0)} min`
                    : `${Math.floor(rutaActual.tiempo_minutos / 60)}h ${(rutaActual.tiempo_minutos % 60).toFixed(0)}m`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
