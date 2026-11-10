// Chauffeurs : candidature (gardée sur l'appareil jusqu'à l'envoi), puis tableau des réservations et étapes de la course.
// Comme sur le site : aucun numéro de sécurité sociale, la vérification passe par un partenaire (Checkr).
import { ApiError, booking, formatUsPhone, isEmail, isUsPhone, phoneDigits } from './booking'
import type { VehicleCode } from './fleet'
import type { Day, Trip } from './trips'
import { rpc, signOut } from './supabase'

export type VehicleType = 'Sedan' | 'SUV' | 'Minivan' | 'Luxury Sedan' | 'Luxury SUV'
export type DocCode = 'license' | 'insurance'
export type RidePref = 'private_only' | 'private_and_shared'

export type DriverApplication = {
  step: number
  firstName: string; lastName: string; email: string; birthDate: string; city: string
  phone: string; phoneVerified: boolean
  vehicleType: VehicleType; seats: number; make: string; model: string; year: string; color: string; plate: string
  licenseNumber: string; insuranceInfo: string; docs: Partial<Record<DocCode, string>>
  days: Day[]; availabilityNotes: string; ridePref: RidePref
  consent: boolean
  submittedAt?: string
}

export const STEPS = ['About you', 'Phone', 'Vehicle', 'License', 'Availability', 'Review'] as const
export const driverCities = ['Cincinnati, OH', 'Florence, KY', 'Covington, KY', 'Newport, KY']
export const vehicleTypes: { code: VehicleType; seats: number[] }[] = [
  { code: 'Sedan', seats: [4] },
  { code: 'SUV', seats: [5, 6, 7] },
  { code: 'Minivan', seats: [6, 7] },
  { code: 'Luxury Sedan', seats: [4] },
  { code: 'Luxury SUV', seats: [5, 6, 7] },
]
export const documents: { code: DocCode; label: string; hint: string; file: string }[] = [
  { code: 'license', label: "Driver's license photo", hint: 'Front and back, not expired', file: 'license.jpg' },
  { code: 'insurance', label: 'Insurance card', hint: 'Your name and this vehicle on it', file: 'insurance.pdf' },
]
export const ridePrefs: { code: RidePref; label: string; body: string }[] = [
  { code: 'private_only', label: 'Private rides only', body: 'One booking at a time.' },
  { code: 'private_and_shared', label: 'Private and weekly shared', body: 'Also home-to-work commutes, billed weekly.' },
]

const MIN_AGE = 21
const OLDEST_YEAR = new Date().getFullYear() - 14
const PREMIUM_YEAR = new Date().getFullYear() - 6

const KEY = 'safemobility-driver'
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function blank(): DriverApplication {
  const c = booking.savedContact()
  const [firstName = '', ...rest] = (c?.fullName ?? '').split(' ')
  return {
    step: 0, firstName, lastName: rest.join(' '), email: c?.email ?? '', birthDate: '', city: driverCities[0],
    phone: c ? formatUsPhone(c.phone) : '', phoneVerified: false,
    vehicleType: 'Sedan', seats: 4, make: '', model: '', year: '', color: '', plate: '',
    licenseNumber: '', insuranceInfo: '', docs: {},
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], availabilityNotes: '', ridePref: 'private_only', consent: false,
  }
}
function load(): DriverApplication | undefined {
  try { const raw = globalThis.localStorage?.getItem(KEY); return raw ? JSON.parse(raw) : undefined } catch { return undefined }
}
function store(a: DriverApplication) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(a)) } catch { /* stockage indisponible */ }
}

export const formatBirthDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
function age(mmddyyyy: string): number | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mmddyyyy)
  if (!m) return undefined
  const [mo, d, y] = [+m[1], +m[2], +m[3]]
  const born = new Date(y, mo - 1, d)
  if (born.getMonth() !== mo - 1 || born.getDate() !== d || y < 1900) return undefined
  const now = new Date()
  return now.getFullYear() - y - (now < new Date(now.getFullYear(), mo - 1, d) ? 1 : 0)
}

// Classes de réservation que la voiture peut faire, d'après son type, ses places et son année.
export function eligibleClasses(a: Pick<DriverApplication, 'vehicleType' | 'seats' | 'year'>): VehicleCode[] {
  const y = +a.year
  if (!y || y < OLDEST_YEAR) return []
  const out: VehicleCode[] = ['sedan']
  const big = a.vehicleType !== 'Sedan' && a.vehicleType !== 'Luxury Sedan'
  if (big && a.seats >= 5) out.push('suv')
  if (big && a.seats >= 7 && y >= PREMIUM_YEAR) out.push('premium')
  return out
}
export const classRule: Record<VehicleCode, string> = { sedan: `${OLDEST_YEAR} or newer`, suv: 'SUV or minivan, 5+ seats', premium: `7 seats, ${PREMIUM_YEAR} or newer` }

export type FieldErrors = Partial<Record<keyof DriverApplication, string>>

export function validate(step: number, a: DriverApplication): FieldErrors {
  const e: FieldErrors = {}
  if (step === 0) {
    if (!a.firstName.trim()) e.firstName = 'Add your first name.'
    if (!a.lastName.trim()) e.lastName = 'Add your last name as it appears on your license.'
    if (!isEmail(a.email)) e.email = 'Enter a valid email address.'
    const n = age(a.birthDate)
    if (n === undefined) e.birthDate = 'Use the format MM/DD/YYYY.'
    else if (n < MIN_AGE) e.birthDate = `You need to be at least ${MIN_AGE} to drive with StatesMob.`
  }
  if (step === 1) {
    if (!isUsPhone(a.phone)) e.phone = 'Enter a 10-digit US phone number.'
    else if (!a.phoneVerified) e.phoneVerified = 'Verify your number to continue.'
  }
  if (step === 2) {
    if (!a.make.trim()) e.make = 'Add the make, e.g. Toyota.'
    if (!a.model.trim()) e.model = 'Add the model, e.g. RAV4.'
    const y = +a.year
    if (!/^\d{4}$/.test(a.year) || y > new Date().getFullYear() + 1) e.year = 'Enter a 4-digit year.'
    else if (y < OLDEST_YEAR) e.year = `Vehicles need to be ${OLDEST_YEAR} or newer.`
    if (!a.color.trim()) e.color = 'Add the color.'
    if (!/^[A-Z0-9 -]{2,8}$/.test(a.plate.trim())) e.plate = 'Enter the plate as shown, 2 to 8 characters.'
  }
  if (step === 3) {
    if (!/^[A-Z0-9-]{5,20}$/i.test(a.licenseNumber.trim())) e.licenseNumber = 'Enter your license number, 5 to 20 letters or digits.'
    if (a.insuranceInfo.trim().length < 5) e.insuranceInfo = 'Add your insurer and policy number, e.g. State Farm — POL123456.'
    if (documents.some((d) => !a.docs[d.code])) e.docs = 'Add both photos to continue.'
  }
  if (step === 4 && !a.days.length) e.days = 'Pick at least one day.'
  if (step === 5 && !a.consent) e.consent = 'Your consent is needed to run the background check.'
  return e
}

let pendingCode: string | undefined

export const driver = {
  // Reprend la candidature commencée, ou en ouvre une pré-remplie avec le profil passager.
  open: (): DriverApplication => load() ?? blank(),
  saved: (): DriverApplication | undefined => load(),
  save: (a: DriverApplication) => store(a),

  sendCode: async (phone: string): Promise<string> => {
    await wait(600)
    if (!isUsPhone(phone)) throw new ApiError('invalid_phone', 'Enter a 10-digit US phone number.')
    pendingCode = String(Math.floor(100000 + Math.random() * 900000))
    return pendingCode
  },
  checkCode: async (code: string): Promise<void> => {
    await wait(400)
    if (!pendingCode || code.replace(/\D/g, '') !== pendingCode) throw new ApiError('bad_code', "That code doesn't match. Check the text message and try again.")
    pendingCode = undefined
  },
  // Envoi d'une photo (démo : on garde seulement le nom du fichier).
  upload: async (code: DocCode): Promise<string> => {
    await wait(900)
    return documents.find((d) => d.code === code)!.file
  },

  submit: async (a: DriverApplication): Promise<DriverAccount> => {
    for (let i = 0; i < STEPS.length; i++) {
      if (Object.keys(validate(i, a)).length) throw new ApiError('incomplete', `Some details in “${STEPS[i]}” need attention.`)
    }
    const done = { ...a, phone: phoneDigits(a.phone), plate: a.plate.trim().toUpperCase(), submittedAt: new Date().toISOString() }
    const account = await rpc<DriverAccount>('driver', 'driver_register', { p: {
      firstName: done.firstName.trim(), lastName: done.lastName.trim(), phone: done.phone, email: done.email.trim(), city: done.city,
      classes: eligibleClasses(done), licenseNumber: done.licenseNumber.trim().toUpperCase(), insuranceInfo: done.insuranceInfo.trim(),
      days: done.days, availabilityNotes: done.availabilityNotes.trim(), ridePref: done.ridePref,
      vehicle: { type: done.vehicleType, seats: done.seats, make: done.make.trim(), model: done.model.trim(), year: +done.year, color: done.color.trim(), plate: done.plate },
    } })
    store(done)
    return account
  },
  clear: () => { try { globalThis.localStorage?.removeItem(KEY) } catch { /* idem */ } signOut('driver') },
}

// ───────── mode chauffeur ─────────

export type DriverAccount = {
  id: string; firstName: string; lastName: string; phone: string; email: string; city: string
  vehicle: { type: VehicleType; seats: number; make: string; model: string; year: number; color: string; plate: string }
  classes: VehicleCode[]; days: Day[]; ridePref: RidePref; rating: number; ratingsCount: number
  verifiedAt: string; verified: boolean
}
export type Board = { verified: boolean; open: Trip[]; mine: Trip[] }
export type DriverStep = 'on_the_way' | 'arrived' | 'in_progress' | 'completed'

export const driving = {
  me: () => rpc<DriverAccount | null>('driver', 'driver_me'),
  board: () => rpc<Board>('driver', 'driver_board'),
  trip: (id: string) => rpc<Trip>('driver', 'get_trip', { p_id: id }),
  accept: (id: string) => rpc<Trip>('driver', 'driver_accept', { p_id: id }),
  step: (id: string, status: DriverStep, eta?: number) => rpc<Trip>('driver', 'driver_step', { p_id: id, p_status: status, p_eta: eta ?? null }),
  release: (id: string) => rpc<Trip>('driver', 'driver_release', { p_id: id }),
  history: () => rpc<Trip[]>('driver', 'driver_trips'),
  locate: (id: string, p: { lat: number; lng: number; heading: number }) =>
    rpc<void>('driver', 'driver_location', { p_id: id, p_lat: p.lat, p_lng: p.lng, p_heading: Math.round(p.heading) }),
}
