import { useEffect, useRef, type ReactNode } from 'react'
import { View } from 'react-native'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { color, tokens } from '@/theme'

type LngLat = { lng: number; lat: number }

// Tuiles OpenStreetMap, assombries pour le thème de l'app (usage modéré, attribution obligatoire).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const DARK = 'invert(1) hue-rotate(185deg) brightness(0.85) contrast(0.85) saturate(0.25)'
const DOWNTOWN: L.LatLngTuple = [39.1015, -84.5125]
const ll = (p: LngLat): L.LatLngTuple => [p.lat, p.lng]

const dot = (fill: string, square = false, size = 18) => L.divIcon({
  className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  html: `<div style="width:${size}px;height:${size}px;border-radius:${square ? 4 : size / 2}px;background:${fill};border:3px solid ${color('bg')};box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`,
})

// Voiture vue de dessus, orientée dans le sens de la marche.
const carIcon = (heading: number) => L.divIcon({
  className: '', iconSize: [40, 40], iconAnchor: [20, 20],
  html: `<div style="width:40px;height:40px;border-radius:20px;background:${color('bg')};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.6);border:2px solid ${color('accent')}">
    <svg width="20" height="20" viewBox="0 0 24 24" style="transform:rotate(${heading}deg)"><path d="M12 2 L19 21 L12 17 L5 21 Z" fill="${color('accent')}"/></svg></div>`,
})

const meIcon = L.divIcon({
  className: '', iconSize: [56, 56], iconAnchor: [28, 28],
  html: `<div style="width:56px;height:56px;border-radius:28px;background:${color('accent')}22;display:flex;align-items:center;justify-content:center">
    <div style="width:18px;height:18px;border-radius:9px;background:${color('accent')};border:3px solid ${color('bg')}"></div></div>`,
})

const pinIcon = L.divIcon({
  className: '', iconSize: [28, 42], iconAnchor: [14, 42],
  html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:28px;height:28px;border-radius:14px;background:${color('text')};border:4px solid ${color('bg')}"></div><div style="width:3px;height:14px;background:${color('text')}"></div></div>`,
})

// Vraie carte interactive (OpenStreetMap) : départ, arrivée, itinéraire, chauffeur en direct, position du client, épingle.
export function RideMap({ pickup, dropoff, driver, me, route, children, label = 'Map', onPick, pin }: {
  pickup?: LngLat | null; dropoff?: LngLat | null; driver?: (LngLat & { heading?: number }) | null; me?: LngLat | null
  route?: LngLat[] | null; children?: ReactNode; label?: string
  onPick?: (p: LngLat) => void; pin?: LngLat | null
}) {
  const box = useRef<View>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<{ route?: L.Polyline; pickup?: L.Marker; dropoff?: L.Marker; driver?: L.Marker; me?: L.Marker; pin?: L.Marker }>({})
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  // Création de la carte, une seule fois.
  useEffect(() => {
    const el = box.current as unknown as HTMLElement
    const m = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: !!onPick, center: DOWNTOWN, zoom: 13 })
    const tiles = L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m)
    tiles.getContainer()!.style.filter = DARK
    m.attributionControl.setPrefix(false)
    m.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    // La carte peut naître avant d'avoir sa taille (0 px) : on recadre dès qu'elle en a une.
    let sized = false
    const ro = new ResizeObserver(() => {
      m.invalidateSize()
      if (!sized && el.clientWidth > 0 && el.clientHeight > 0) { sized = true; frameRef.current() }
    })
    ro.observe(el)
    map.current = m
    return () => { ro.disconnect(); m.remove(); map.current = null; layers.current = {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Un marqueur par rôle : on le crée, le déplace ou l'enlève.
  const place = (key: 'pickup' | 'dropoff' | 'driver' | 'me' | 'pin', p: LngLat | null | undefined, icon: () => L.DivIcon) => {
    const m = map.current
    if (!m) return
    const cur = layers.current[key]
    if (!p) { cur?.remove(); delete layers.current[key]; return }
    if (cur) { cur.setLatLng(ll(p)); cur.setIcon(icon()) }
    else layers.current[key] = L.marker(ll(p), { icon: icon(), interactive: false, keyboard: false }).addTo(m)
  }

  const routeKey = route ? `${route.length}:${route[0]?.lat}:${route[route.length - 1]?.lng}` : ''
  useEffect(() => {
    const m = map.current
    if (!m) return
    layers.current.route?.remove()
    delete layers.current.route
    if (route && route.length > 1) {
      layers.current.route = L.polyline(route.map(ll), { color: color('route'), weight: 5, opacity: 0.95, interactive: false }).addTo(m)
    }
  }, [routeKey])

  useEffect(() => { place('pickup', pickup, () => dot(color('marker-pickup'))) }, [pickup?.lat, pickup?.lng])
  useEffect(() => { place('dropoff', dropoff, () => dot(color('marker-dropoff'), true)) }, [dropoff?.lat, dropoff?.lng])
  useEffect(() => { place('driver', driver, () => carIcon(driver?.heading ?? 0)) }, [driver?.lat, driver?.lng, driver?.heading])
  useEffect(() => { place('me', pickup ? null : me, () => meIcon) }, [me?.lat, me?.lng, !!pickup])
  useEffect(() => { place('pin', pin, () => pinIcon) }, [pin?.lat, pin?.lng])

  // Cadrage : tout ce qui compte tient dans la carte. L'épingle ne recadre pas (on la place sur une carte immobile).
  const frameKey = [routeKey, pickup?.lat, dropoff?.lat, me?.lat, !!driver].join('|')
  const frameRef = useRef(() => {})
  frameRef.current = () => {
    const m = map.current
    const el = box.current as unknown as HTMLElement | null
    if (!m || !el?.clientWidth || !el.clientHeight) return
    const pts = [pickup, dropoff, driver, me, ...(route ?? [])].filter(Boolean) as LngLat[]
    if (!pts.length) { if (!pin) m.setView(DOWNTOWN, 13); return }
    if (pts.length === 1) { m.setView(ll(pts[0]), 15); return }
    m.fitBounds(L.latLngBounds(pts.map(ll)), { padding: [40, 40], maxZoom: 16 })
  }
  useEffect(() => { frameRef.current() }, [frameKey])

  // Le chauffeur sort du cadre : on recadre en le gardant visible.
  useEffect(() => {
    const m = map.current
    if (!m || !driver) return
    if (!m.getBounds().pad(-0.1).contains(ll(driver))) {
      const pts = [driver, pickup, dropoff].filter(Boolean) as LngLat[]
      m.fitBounds(L.latLngBounds(pts.map(ll)), { padding: [40, 40], maxZoom: 16 })
    }
  }, [driver?.lat, driver?.lng])

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flex: 1, backgroundColor: color('surface-2'), overflow: 'hidden' }}>
      <View ref={box} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 }} />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 500 }}>{children}</View>
    </View>
  )
}

export const mapInset = tokens.layout.gutter
