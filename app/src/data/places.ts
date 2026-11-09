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

// ───────── recherche ─────────

const RECENT = 'safemobility-recent'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const uid = () => `PL${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase()

function recentIds(): string[] {
  try { const raw = globalThis.localStorage?.getItem(RECENT); return raw ? JSON.parse(raw) : [AIRPORT_ID, 'p4'] } catch { return [AIRPORT_ID, 'p4'] }
}

export const geo = {
  myPosition: async () => { await wait(200); return { ...myPosition } },
  reverse: async (p: LngLat): Promise<Place> => {
    const nearest = [...places].sort((a, b) => distanceM(a.point, p) - distanceM(b.point, p))[0]
    const d = distanceM(nearest.point, p)
    return d < 250 ? { ...nearest } : { id: uid(), name: `Near ${nearest.name}`, detail: `${Math.round(d / 1609.34 * 10) / 10} mi away · pinned location`, point: p, kind: 'street' }
  },
  recent: async (): Promise<Place[]> => recentIds().map((id) => places.find((p) => p.id === id)).filter(Boolean).map((p) => ({ ...(p as Place), kind: 'recent' as const })),
  remember: (p: Place) => {
    if (!places.some((x) => x.id === p.id)) return
    const ids = [p.id, ...recentIds().filter((x) => x !== p.id)].slice(0, 4)
    try { globalThis.localStorage?.setItem(RECENT, JSON.stringify(ids)) } catch { /* stockage indisponible */ }
  },
  search: async (text: string): Promise<Place[]> => {
    await wait(150)
    const q = norm(text.trim())
    return q.length < 2 ? [] : places.filter((p) => norm(p.name).includes(q) || norm(p.detail).includes(q)).slice(0, 8)
  },
}

export const formatUSD = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
export const formatMiles = (m: number) => `${(m / 1609.34).toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`
export const formatMinutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`
