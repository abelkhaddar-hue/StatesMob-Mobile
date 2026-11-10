// Lieux de Cincinnati / Northern Kentucky, recherche d'adresse et géométrie simplifiée
// (en attendant Google Places et Distance Matrix, comme sur le site).

export type LngLat = { lng: number; lat: number }
export type PlaceKind = 'landmark' | 'airport' | 'stadium' | 'mall' | 'station' | 'street' | 'hotel' | 'recent'
export type Place = { id: string; name: string; detail: string; point: LngLat; kind?: PlaceKind }

export const myPosition: LngLat = { lat: 39.1009, lng: -84.5120 }
const area = { minLat: 38.85, maxLat: 39.45, minLng: -84.95, maxLng: -84.15 }
export const AIRPORT_ID = 'p2'

export const places: Place[] = [
  { id: 'p1', name: 'Fountain Square', detail: '520 Vine St, Downtown', point: { lat: 39.1015, lng: -84.5125 }, kind: 'landmark' },
  { id: AIRPORT_ID, name: 'CVG Airport', detail: 'Cincinnati/Northern Kentucky International, Hebron, KY', point: { lat: 39.0489, lng: -84.6678 }, kind: 'airport' },
  { id: 'p3', name: 'Hyde Park Square', detail: 'Erie Ave, Hyde Park', point: { lat: 39.1387, lng: -84.4423 }, kind: 'landmark' },
  { id: 'p4', name: 'Great American Ball Park', detail: '100 Joe Nuxhall Way, The Banks', point: { lat: 39.0974, lng: -84.5066 }, kind: 'stadium' },
  { id: 'p5', name: 'Paycor Stadium', detail: '1 Paycor Stadium, The Banks', point: { lat: 39.0954, lng: -84.5161 }, kind: 'stadium' },
  { id: 'p6', name: 'Findlay Market', detail: '1801 Race St, Over-the-Rhine', point: { lat: 39.1153, lng: -84.5188 }, kind: 'landmark' },
  { id: 'p7', name: 'University of Cincinnati', detail: '2600 Clifton Ave, Clifton', point: { lat: 39.1329, lng: -84.5150 }, kind: 'landmark' },
  { id: 'p8', name: 'Kenwood Towne Centre', detail: '7875 Montgomery Rd, Kenwood', point: { lat: 39.2009, lng: -84.3733 }, kind: 'mall' },
  { id: 'p9', name: 'Cincinnati Union Terminal', detail: '1301 Western Ave, Queensgate', point: { lat: 39.1098, lng: -84.5376 }, kind: 'station' },
  { id: 'p10', name: 'Newport on the Levee', detail: '1 Levee Way, Newport, KY', point: { lat: 39.0947, lng: -84.4955 }, kind: 'mall' },
  { id: 'p11', name: 'Cincinnati Zoo', detail: '3400 Vine St, Avondale', point: { lat: 39.1452, lng: -84.5087 }, kind: 'landmark' },
  { id: 'p12', name: 'Roebling Point', detail: 'Court St, Covington, KY', point: { lat: 39.0880, lng: -84.5088 }, kind: 'street' },
  { id: 'p13', name: "Cincinnati Children's Hospital", detail: '3333 Burnet Ave, Avondale', point: { lat: 39.1405, lng: -84.5023 }, kind: 'landmark' },
  { id: 'p14', name: 'Mariemont Square', detail: 'Wooster Pike, Mariemont', point: { lat: 39.1451, lng: -84.3744 }, kind: 'street' },
  { id: 'p15', name: 'Hilton Netherland Plaza', detail: '35 W 5th St, Downtown', point: { lat: 39.1006, lng: -84.5145 }, kind: 'hotel' },
  { id: 'p16', name: '21c Museum Hotel', detail: '609 Walnut St, Downtown', point: { lat: 39.1029, lng: -84.5106 }, kind: 'hotel' },
  { id: 'p17', name: 'Florence Mall', detail: '2028 Florence Mall, Florence, KY', point: { lat: 38.9982, lng: -84.6466 }, kind: 'mall' },
  { id: 'p18', name: 'Mason · Kings Island', detail: '6300 Kings Island Dr, Mason, OH', point: { lat: 39.3446, lng: -84.2687 }, kind: 'landmark' },
  { id: 'p19', name: 'P&G Tower', detail: '1 Procter & Gamble Plaza, Downtown', point: { lat: 39.1028, lng: -84.5043 }, kind: 'street' },
  { id: 'p20', name: 'Duke Energy Convention Center', detail: '525 Elm St, Downtown', point: { lat: 39.1013, lng: -84.5178 }, kind: 'landmark' },
]

// ───────── géométrie ─────────

const rad = (d: number) => (d * Math.PI) / 180
export function distanceM(a: LngLat, b: LngLat) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
const lerp = (a: LngLat, b: LngLat, t: number): LngLat => ({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t })
const bearing = (a: LngLat, b: LngLat) => (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI + 360) % 360
export const inArea = (p: LngLat) => p.lat >= area.minLat && p.lat <= area.maxLat && p.lng >= area.minLng && p.lng <= area.maxLng

// Itinéraire « en escalier » qui ressemble à des rues (la vraie carte donnera le vrai trajet).
export function fakeRoute(a: LngLat, b: LngLat): LngLat[] {
  const m1 = { lng: a.lng + (b.lng - a.lng) * 0.35, lat: a.lat }
  const m2 = { lng: m1.lng, lat: a.lat + (b.lat - a.lat) * 0.7 }
  return [a, m1, m2, { lng: b.lng, lat: m2.lat }, b]
}
const routeLength = (r: LngLat[]) => r.slice(1).reduce((s, p, i) => s + distanceM(r[i], p), 0)
export function alongRoute(r: LngLat[], t: number): LngLat & { heading: number } {
  let d = routeLength(r) * Math.max(0, Math.min(1, t))
  for (let i = 1; i < r.length; i++) {
    const seg = distanceM(r[i - 1], r[i])
    if (d <= seg || i === r.length - 1) return { ...lerp(r[i - 1], r[i], seg ? Math.min(1, d / seg) : 1), heading: bearing(r[i - 1], r[i]) }
    d -= seg
  }
  return { ...r[r.length - 1], heading: 0 }
}
// Distance par la route (≈ +15 %) et durée à ~40 km/h en ville, +2 min.
export function trip(a: LngLat, b: LngLat) {
  const route = fakeRoute(a, b)
  const distanceM = Math.max(500, Math.round(routeLength(route) * 1.15))
  const durationS = Math.round(distanceM / (40000 / 3600)) + 120
  return { route, distanceM, durationS }
}

// ───────── itinéraire (OSRM, données OpenStreetMap) ─────────

export type Route = { route: LngLat[]; distanceM: number; durationS: number; estimated?: boolean }

const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const routes = new Map<string, Promise<Route>>()

// Vrai trajet par la route : tracé, distance et durée. Si le service ne répond pas, estimation à vol d'oiseau.
export function route(a: LngLat, b: LngLat): Promise<Route> {
  const k = [a.lng, a.lat, b.lng, b.lat].map((x) => x.toFixed(5)).join(',')
  if (!routes.has(k)) {
    const p = (async () => {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 8000)
      try {
        const res = await fetch(`${OSRM}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ctl.signal })
        const j = await res.json()
        const r = j.routes?.[0]
        if (j.code !== 'Ok' || !r) throw new Error(j.code)
        return { route: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lng, lat })), distanceM: Math.round(r.distance), durationS: Math.round(r.duration) }
      } catch {
        routes.delete(k)
        return { ...trip(a, b), estimated: true }
      } finally { clearTimeout(t) }
    })()
    routes.set(k, p)
  }
  return routes.get(k)!
}

// ───────── recherche d'adresse (Photon, données OpenStreetMap) et GPS ─────────

const PHOTON = 'https://photon.komoot.io'
const RECENT = 'safemobility-recent-places'
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const uid = () => `PL${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase()
const states: Record<string, string> = { Ohio: 'OH', Kentucky: 'KY', Indiana: 'IN' }

type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }

function kindOf(p: PhotonFeature['properties']): PlaceKind {
  const k = p.osm_key, v = p.osm_value
  if (k === 'aeroway') return 'airport'
  if (k === 'tourism' && (v === 'hotel' || v === 'motel')) return 'hotel'
  if (v === 'stadium' || v === 'sports_centre') return 'stadium'
  if (k === 'railway' || v === 'station' || v === 'bus_station') return 'station'
  if (k === 'shop' || v === 'mall' || v === 'marketplace') return 'mall'
  if (k === 'highway' || k === 'building' || k === 'place') return 'street'
  return 'landmark'
}

function toPlace(f: PhotonFeature): Place {
  const p = f.properties
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const name = p.name || street || p.city || 'Pinned location'
  const city = [p.city || p.town || p.village || p.county, p.state ? states[p.state] ?? p.state : undefined].filter(Boolean).join(', ')
  const detail = [street && street !== name ? street : p.district, city].filter(Boolean).join(', ')
  const [lng, lat] = f.geometry.coordinates
  return { id: `${p.osm_type}${p.osm_id}`, name, detail: detail || 'Cincinnati area', point: { lat, lng }, kind: kindOf(p) }
}

async function photon(path: string): Promise<PhotonFeature[]> {
  const res = await fetch(`${PHOTON}${path}`)
  if (!res.ok) throw new Error(String(res.status))
  return ((await res.json()).features ?? []) as PhotonFeature[]
}

function recentPlaces(): Place[] {
  try { const raw = globalThis.localStorage?.getItem(RECENT); if (raw) return JSON.parse(raw) } catch { /* stockage indisponible */ }
  return [AIRPORT_ID, 'p4'].map((id) => places.find((p) => p.id === id)!)
}

export type Fix = { point: LngLat; source: 'gps' | 'outside' | 'unavailable' }
let lastFix: Promise<Fix> | null = null

export const geo = {
  // Position GPS du client. Hors zone desservie (ou GPS refusé) : centre-ville, et on le dit à l'écran.
  locate: (fresh = false): Promise<Fix> => {
    if (!lastFix || fresh) {
      lastFix = (async (): Promise<Fix> => {
        try {
          const Location = await import('expo-location')
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status !== 'granted') return { point: { ...myPosition }, source: 'unavailable' }
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          return inArea(point) ? { point, source: 'gps' } : { point: { ...myPosition }, source: 'outside' }
        } catch {
          return { point: { ...myPosition }, source: 'unavailable' }
        }
      })()
    }
    return lastFix
  },
  myPosition: async () => (await geo.locate()).point,
  reverse: async (p: LngLat): Promise<Place> => {
    const near = [...places].sort((a, b) => distanceM(a.point, p) - distanceM(b.point, p))[0]
    if (distanceM(near.point, p) < 120) return { ...near }
    try {
      const [f] = await photon(`/reverse?lat=${p.lat}&lon=${p.lng}&lang=en&limit=1`)
      if (f) return { ...toPlace(f), id: uid(), point: p }
    } catch { /* service indisponible */ }
    const d = distanceM(near.point, p)
    return { id: uid(), name: `Near ${near.name}`, detail: `${Math.round(d / 1609.34 * 10) / 10} mi away · pinned location`, point: p, kind: 'street' }
  },
  recent: async (): Promise<Place[]> => recentPlaces().map((p) => ({ ...p, kind: 'recent' as const })),
  remember: (p: Place) => {
    const list = [{ ...p, kind: p.kind === 'recent' ? 'street' as const : p.kind }, ...recentPlaces().filter((x) => x.id !== p.id)].slice(0, 5)
    try { globalThis.localStorage?.setItem(RECENT, JSON.stringify(list)) } catch { /* stockage indisponible */ }
  },
  // Lieux connus d'abord (aéroport, hôtels…), puis toutes les adresses OpenStreetMap de la région.
  search: async (text: string): Promise<Place[]> => {
    const q = norm(text.trim())
    if (q.length < 2) return []
    const local = places.filter((p) => norm(p.name).includes(q) || norm(p.detail).includes(q)).slice(0, 4)
    let found: Place[] = []
    try {
      const bbox = [area.minLng, area.minLat, area.maxLng, area.maxLat].join(',')
      found = (await photon(`/api/?q=${encodeURIComponent(text.trim())}&lat=${myPosition.lat}&lon=${myPosition.lng}&bbox=${bbox}&limit=8&lang=en`)).map(toPlace)
    } catch {
      if (!local.length) throw new Error('Address search is unavailable right now. Try again, or drop a pin on the map.')
    }
    const fresh = found.filter((f) => !local.some((l) => distanceM(l.point, f.point) < 150))
    const seen = new Set<string>()
    return [...local, ...fresh].filter((p) => { const k = `${p.name}|${p.detail}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 8)
  },
}

export const formatUSD = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
export const formatMiles = (m: number) => `${(m / 1609.34).toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`
export const formatMinutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`

// Reste du trajet à partir de la position actuelle (on coupe ce qui est déjà parcouru).
export function remaining(r: LngLat[] | null | undefined, from: LngLat | null | undefined): LngLat[] | null {
  if (!r?.length || !from) return r ?? null
  let best = 0
  r.forEach((p, i) => { if (distanceM(p, from) < distanceM(r[best], from)) best = i })
  return [from, ...r.slice(best + 1)]
}
