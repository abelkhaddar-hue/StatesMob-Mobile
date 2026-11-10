// Partage de la position du chauffeur pendant la course : GPS du téléphone, envoyé à la base toutes les 4 secondes.
// Sans GPS dans la zone desservie (test depuis un ordinateur ailleurs), on simule un trajet réaliste sur la vraie route.
import { useEffect, useRef, useState } from 'react'
import { alongRoute, inArea, route, type LngLat, type Route } from './places'
import { approachStart, type Trip } from './trips'
import { driving } from './driver'

export type Shared = { point: LngLat & { heading: number }; mode: 'gps' | 'simulated' } | null

const SEND_EVERY_MS = 4000
const bearing = (a: LngLat, b: LngLat) => (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI + 360) % 360

export function useShareLocation(t: Trip | undefined): Shared {
  const active = !!t && (t.status === 'on_the_way' || t.status === 'arrived' || t.status === 'in_progress')
  const [gps, setGps] = useState<LngLat & { heading: number } | null>(null)
  const [path, setPath] = useState<Route | null>(null)
  const [shared, setShared] = useState<Shared>(null)
  const last = useRef<LngLat | null>(null)

  // GPS du téléphone, seulement pendant la course.
  useEffect(() => {
    if (!active) return
    let sub: { remove: () => void } | undefined
    let alive = true
    import('expo-location').then(async (Location) => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || !alive) return
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 }, (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const heading = pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : last.current ? bearing(last.current, p) : 0
        last.current = p
        setGps({ ...p, heading })
      })
    }).catch(() => {})
    return () => { alive = false; sub?.remove() }
  }, [active])

  const useGps = !!gps && inArea(gps)

  // Trajet simulé sur la vraie route : vers le client, puis vers la destination.
  const leg = t?.status === 'in_progress' ? 'trip' : 'approach'
  useEffect(() => {
    if (!t || !active || useGps) return
    const [a, b] = leg === 'trip' ? [t.pickup.point, t.destination.point] : [approachStart(t), t.pickup.point]
    route(a, b).then(setPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id, leg, active, useGps])

  useEffect(() => {
    if (!t || !active) { setShared(null); return }
    const tick = () => {
      let point: LngLat & { heading: number }
      if (useGps) point = gps!
      else if (t.status === 'arrived') point = { ...t.pickup.point, heading: 0 }
      else if (!path) return
      else {
        const since = (Date.now() - Date.parse((t.status === 'in_progress' ? t.startedAt : t.onTheWayAt) ?? new Date().toISOString())) / 1000
        const total = t.status === 'in_progress' ? path.durationS : (t.etaMinutes ?? 10) * 60
        point = alongRoute(path.route, Math.min(t.status === 'in_progress' ? 0.98 : 1, since / total))
      }
      setShared({ point, mode: useGps ? 'gps' : 'simulated' })
      driving.locate(t.id, point).catch(() => {})
    }
    tick()
    const iv = setInterval(tick, SEND_EVERY_MS)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id, t?.status, active, useGps, gps?.lat, gps?.lng, path])

  return shared
}
