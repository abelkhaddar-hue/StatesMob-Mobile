import { useSyncExternalStore } from 'react'
import type { Place } from './places'
import type { Payment, TripType, VehicleCode } from './fleet'

// Brouillon partagé entre l'accueil, la recherche d'adresse, l'heure et les écrans de réservation.
// home / work : adresses de l'abonnement semaine.
export type PlaceField = 'pickup' | 'dropoff' | 'home' | 'work'
export type Draft = Record<PlaceField, Place | null> & {
  pickupAt: string | null; passengers: number; vehicle: VehicleCode; tripType: TripType; payment: Payment; notes: string
}

const initial: Draft = {
  pickup: null, dropoff: null, home: null, work: null,
  pickupAt: null, passengers: 1, vehicle: 'sedan', tripType: 'Local Ride', payment: 'cash', notes: '',
}
let state: Draft = initial
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const draft = {
  get: () => state,
  set: (patch: Partial<Draft>) => { state = { ...state, ...patch }; emit() },
  // Après une réservation : on garde le départ, le paiement et les adresses de l'abonnement.
  reset: () => { state = { ...initial, pickup: state.pickup, payment: state.payment, home: state.home, work: state.work }; emit() },
}

export function useDraft() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, draft.get, draft.get)
}

// Le plus petit véhicule qui accueille tout le monde.
export const vehicleFor = (passengers: number): VehicleCode => (passengers > 5 ? 'premium' : passengers > 4 ? 'suv' : 'sedan')
