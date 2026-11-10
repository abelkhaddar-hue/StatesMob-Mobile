// Réservations, suivi et abonnement semaine : tout passe par la base StatesMob (fonctions du schéma « safemobility »).
import { ApiError, booking, phoneDigits } from './booking'
import { alongRoute, fakeRoute, geo, route, type LngLat, type Place } from './places'
import { quote, weeklyEstimate, type Payment, type TripType, type VehicleCode } from './fleet'
import { rpc } from './supabase'

export type TripStatus = 'pending' | 'confirmed' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'

export type TripDriver = {
  id: string; firstName: string; lastName: string; phone: string; rating: number; ratingsCount: number
  vehicle: { type: string; year: number; make: string; model: string; color: string; seats: number; plate: string }
}

export type Trip = {
  id: string; code: string; fullName: string; phone: string; email: string
  pickup: Place; destination: Place; pickupAt: string; passengers: number; tripType: TripType
  vehicle: VehicleCode; payment: Payment; notes: string
  distanceM: number; durationS: number; priceCents: number; fixedRate: boolean
  status: TripStatus; etaMinutes: number | null
  confirmedAt: string | null; onTheWayAt: string | null; arrivedAt: string | null; startedAt: string | null
  completedAt: string | null; cancelledAt: string | null; cancelledBy: 'passenger' | 'driver' | null
  stars: number | null; createdAt: string; driver: TripDriver | null
  driverLocation: { lat: number; lng: number; heading: number; at: string } | null
}

export type PlanStatus = 'pending' | 'quoted' | 'active' | 'cancelled'
export type Plan = {
  id: string; code: string; fullName: string; phone: string; email: string; home: Place; work: Place
  morningTime: string; eveningTime: string; days: Day[]; passengers: number; notes: string; distanceM: number
  pricePerWeekCents: number | null; status: PlanStatus; quoteReadyAt: string; activatedAt: string | null; createdAt: string
}

export type TrackResult = { found: false } | {
  found: true; code: string; status: TripStatus; pickup: string; destination: string; pickupAt: string; tripType: string
  etaMinutes: number | null; onTheWayAt: string | null
  driver: { name: string; carColor: string; carMake: string; carModel: string; plate: string } | null
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export type Day = (typeof DAYS)[number]

export type BookingInput = {
  pickup: Place; destination: Place; pickupAt: string; passengers: number; tripType: TripType
  vehicle: VehicleCode; payment: Payment; notes: string; fullName: string; phone: string; email: string
}

export type PlanInput = {
  home: Place; work: Place; morningTime: string; eveningTime: string; days: Day[]; passengers: number; notes: string
  fullName: string; phone: string; email: string
}

// Le contact sert à chaque réservation : on le garde pour la prochaine fois.
async function contact(i: { fullName: string; phone: string; email: string }) {
  const c = await booking.saveContact(i)
  return { fullName: c.fullName, phone: phoneDigits(c.phone), email: c.email }
}

export const trips = {
  book: async (i: BookingInput): Promise<Trip> => {
    const q = quote(i.pickup, i.destination, i.vehicle, await route(i.pickup.point, i.destination.point))
    const c = await contact(i)
    const t = await rpc<Trip>('passenger', 'book', { p: { ...i, ...c, distanceM: q.distanceM, durationS: q.durationS, priceCents: q.priceCents, fixedRate: q.fixedRate } })
    geo.remember(i.destination)
    return t
  },
  get: (id: string) => rpc<Trip>('passenger', 'get_trip', { p_id: id }),
  mine: () => rpc<Trip[]>('passenger', 'my_trips'),
  cancel: (id: string) => rpc<Trip>('passenger', 'cancel_trip', { p_id: id }),
  rate: (id: string, stars: number) => rpc<Trip>('passenger', 'rate_trip', { p_id: id, p_stars: stars }),
  track: (phone: string) => {
    const d = phoneDigits(phone)
    if (d.length !== 10) return Promise.reject(new ApiError('invalid_phone', 'Enter the 10-digit phone number you used to book.'))
    return rpc<TrackResult>('passenger', 'track', { p_phone: d })
  },
}

export const plans = {
  create: async (i: PlanInput): Promise<Plan> => {
    if (!i.days.length) throw new ApiError('days_required', 'Pick at least one day.')
    const e = weeklyEstimate(i.home, i.work, i.days.length, i.passengers, await route(i.home.point, i.work.point))
    const c = await contact(i)
    return rpc<Plan>('passenger', 'create_plan', { p: { ...i, ...c, distanceM: e.distanceM, pricePerWeekCents: e.pricePerWeekCents } })
  },
  get: (id: string) => rpc<Plan>('passenger', 'get_plan', { p_id: id }),
  mine: () => rpc<Plan[]>('passenger', 'my_plans'),
  accept: (id: string) => rpc<Plan>('passenger', 'accept_plan', { p_id: id }),
  cancel: (id: string) => rpc<Plan>('passenger', 'cancel_plan', { p_id: id }),
}

// ───────── affichage ─────────

export const isActive = (s: TripStatus) => s === 'on_the_way' || s === 'arrived' || s === 'in_progress'
export const isUpcoming = (s: TripStatus) => s === 'pending' || s === 'confirmed' || isActive(s)

export const statusLabel: Record<TripStatus, string> = {
  pending: 'Awaiting driver', confirmed: 'Driver confirmed', on_the_way: 'Driver on the way', arrived: 'Driver is here',
  in_progress: 'On the way', completed: 'Completed', cancelled: 'Cancelled',
}

export const formatWhen = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
// « 07:30 » → « 7:30 AM »
export const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export const driverName = (d: TripDriver) => `${d.firstName} ${d.lastName.charAt(0)}.`
export const carLine = (d: TripDriver) => `${d.vehicle.color} ${d.vehicle.make} ${d.vehicle.model}`

// Minutes avant l'arrivée du chauffeur, d'après l'heure annoncée au départ.
export function minutesAway(t: Trip) {
  if (t.status !== 'on_the_way' || !t.onTheWayAt || !t.etaMinutes) return null
  const left = t.etaMinutes - (Date.now() - Date.parse(t.onTheWayAt)) / 60000
  return Math.max(1, Math.ceil(left))
}

// Point de départ du chauffeur quand il n'envoie pas encore sa position : à quelques rues du client.
export const approachStart = (t: Pick<Trip, 'pickup' | 'etaMinutes'>): LngLat => {
  const p = t.pickup.point, m = t.etaMinutes ?? 10
  return { lat: p.lat + 0.004 + m * 0.0012, lng: p.lng - 0.006 - m * 0.0015 }
}

// Position en direct envoyée par le téléphone du chauffeur depuis moins d'une minute.
export function livePosition(t: Trip): (LngLat & { heading: number }) | null {
  const l = t.driverLocation
  return l && Date.now() - Date.parse(l.at) < 60_000 ? { lat: l.lat, lng: l.lng, heading: l.heading } : null
}

// Position du chauffeur sur la carte : en direct si possible, sinon estimée d'après les heures de la course.
export function driverPosition(t: Trip): (LngLat & { heading: number }) | null {
  const live = livePosition(t)
  if (live) return live
  const since = (iso: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 1000 : 0)
  if (t.status === 'on_the_way' && t.etaMinutes) return alongRoute(fakeRoute(approachStart(t), t.pickup.point), Math.min(0.95, since(t.onTheWayAt) / (t.etaMinutes * 60)))
  if (t.status === 'arrived') return { ...t.pickup.point, heading: 0 }
  if (t.status === 'in_progress') return alongRoute(fakeRoute(t.pickup.point, t.destination.point), Math.min(0.97, since(t.startedAt) / t.durationS))
  if (t.status === 'completed') return { ...t.destination.point, heading: 0 }
  return null
}
