// La flotte StatesMob, les types de trajet et le calcul du prix.
// Tarifs provisoires (le module de prix du site n'était pas dans le zip) : à remplacer par la grille du client.
import { ApiError } from './booking'
import { AIRPORT_ID, distanceM, inArea, trip, type Place } from './places'

export type VehicleCode = 'sedan' | 'suv' | 'premium'
export type Payment = 'cash' | 'card'

export const fleet: { code: VehicleCode; tag: string; name: string; desc: string; seats: number; bags: number; image: number }[] = [
  { code: 'sedan', tag: 'Sedan', name: 'Toyota Corolla 2020', desc: 'Affordable, clean and reliable. Ideal for solo travelers and short local trips.', seats: 4, bags: 2, image: require('../../assets/fleet/corolla.jpg') },
  { code: 'suv', tag: 'SUV', name: 'Toyota RAV4', desc: 'Spacious SUV for airport transfers, families and extra luggage.', seats: 5, bags: 4, image: require('../../assets/fleet/rav4.jpg') },
  { code: 'premium', tag: 'Premium SUV', name: 'Toyota Grand Highlander', desc: 'Premium ride for groups and long distance, with room for everyone and everything.', seats: 7, bags: 6, image: require('../../assets/fleet/highlander.jpg') },
]
export const vehicle = (c: VehicleCode) => fleet.find((v) => v.code === c)!

export const tripTypes = ['Airport Transfer', 'Local Ride', 'Business Transportation', 'Hourly Service', 'Long Distance', 'Event Transportation'] as const
export type TripType = (typeof tripTypes)[number]

export const payLabel: Record<Payment, string> = { cash: 'Cash', card: 'Credit card' }

// Tarif fixe aéroport (CVG ↔ Cincinnati / NKY), sinon prise en charge + mile + minute. Montants en cents.
const AIRPORT_FLAT: Record<VehicleCode, number> = { sedan: 5500, suv: 7000, premium: 9500 }
const AIRPORT_FLAT_MAX_M = 48000
const rates: Record<VehicleCode, { base: number; perMile: number; perMin: number; min: number }> = {
  sedan: { base: 800, perMile: 250, perMin: 35, min: 1500 },
  suv: { base: 1000, perMile: 320, perMin: 40, min: 2000 },
  premium: { base: 1500, perMile: 420, perMin: 50, min: 3500 },
}

export type Quote = { vehicle: VehicleCode; distanceM: number; durationS: number; priceCents: number; fixedRate: boolean }

export function quote(pickup: Place, destination: Place, v: VehicleCode): Quote {
  if (!inArea(pickup.point)) throw new ApiError('pickup_outside', 'This pickup is outside our service area. Call dispatch for a custom quote.')
  if (!inArea(destination.point)) throw new ApiError('dropoff_outside', 'This destination is outside our service area. Call dispatch for a custom quote.')
  if (distanceM(pickup.point, destination.point) < 300) throw new ApiError('too_short', 'Pickup and destination are too close.')
  const t = trip(pickup.point, destination.point)
  const airport = (pickup.id === AIRPORT_ID || destination.id === AIRPORT_ID) && t.distanceM <= AIRPORT_FLAT_MAX_M
  const r = rates[v]
  const metered = Math.max(r.min, r.base + (r.perMile * t.distanceM) / 1609.34 + (r.perMin * t.durationS) / 60)
  return { vehicle: v, distanceM: t.distanceM, durationS: t.durationS, fixedRate: airport, priceCents: airport ? AIRPORT_FLAT[v] : Math.ceil(metered / 100) * 100 }
}

// Abonnement semaine : aller-retour par jour, 30 % de moins que deux courses à l'unité. Estimation : le dispatch confirme.
export function weeklyEstimate(home: Place, work: Place, days: number, passengers: number) {
  const v: VehicleCode = passengers > 5 ? 'premium' : passengers > 4 ? 'suv' : 'sedan'
  const q = quote(home, work, v)
  return { vehicle: v, distanceM: q.distanceM, pricePerWeekCents: Math.ceil((q.priceCents * 2 * days * 0.7) / 500) * 500 }
}

// Contenu de l'accueil, repris du site.
export const services = [
  { title: 'Airport Transfers', body: 'To and from CVG, timed to your flight.', trip: 'Airport Transfer' },
  { title: 'Local Transportation', body: 'Anywhere across Cincinnati and the area.', trip: 'Local Ride' },
  { title: 'Hotel Transportation', body: 'Pickup and drop-off for hotel guests.', trip: 'Local Ride' },
  { title: 'Business Transportation', body: 'Discreet rides for professionals and executives.', trip: 'Business Transportation' },
  { title: 'Long Distance Trips', body: 'Safe, comfortable travel outside the city.', trip: 'Long Distance' },
  { title: 'Event Transportation', body: 'Weddings, concerts and special occasions.', trip: 'Event Transportation' },
] as const satisfies readonly { title: string; body: string; trip: TripType }[]

export const reasons = ['Available 24/7', 'Professional drivers', 'Airport specialists', 'Comfortable vehicles', 'Transparent pricing', 'Easy booking']

export const testimonials = [
  { quote: 'Booked an early airport run for a 5am flight and the driver was outside ten minutes before pickup. Smooth, quiet ride to CVG.', name: 'Margaret H.', place: 'Hyde Park, Cincinnati' },
  { quote: 'We use StatesMob for client pickups now instead of rideshare apps. Cleaner cars, and drivers who know the city.', name: 'David O.', place: 'Downtown Cincinnati' },
  { quote: 'Booked the Grand Highlander for a wedding party of seven. Everyone fit comfortably with luggage.', name: 'Angela R.', place: 'Mason, Ohio' },
]
