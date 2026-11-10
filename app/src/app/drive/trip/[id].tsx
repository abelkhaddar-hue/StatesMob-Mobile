import { useState } from 'react'
import { Linking, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ban, BadgeCheck, Phone } from 'lucide-react-native'
import { vehicle } from '@/data/fleet'
import { formatMiles, formatMinutes, formatUSD, remaining } from '@/data/places'
import { driving, type DriverStep } from '@/data/driver'
import { formatWhen, statusLabel, type Trip } from '@/data/trips'
import { useShareLocation } from '@/data/live'
import { useAction, useLoad, useRoute } from '@/data/hooks'
import { formatUsPhone } from '@/data/booking'
import { color, tokens } from '@/theme'
import { ErrorBlock, Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Avatar, Banner, Chip, Divider, EmptyState } from '@/ui/primitives'
import { RideMap } from '@/ui/map'
import { RouteSummary } from '@/ui/trip'
import { haptic } from '@/ui/haptics'
import { Eyebrow } from '@/ui/sm'

const next: Partial<Record<Trip['status'], { to: DriverStep; label: string }>> = {
  confirmed: { to: 'on_the_way', label: "I'm on my way" },
  on_the_way: { to: 'arrived', label: "I've arrived" },
  arrived: { to: 'in_progress', label: 'Passenger on board' },
  in_progress: { to: 'completed', label: 'Complete ride' },
}
const ETAS = [5, 10, 15, 20, 30]

// Course confirmée côté chauffeur : partir (avec heure d'arrivée envoyée au passager), arriver, prendre en charge, déposer.
export default function DriveTrip() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const trip = useLoad<Trip>(() => driving.trip(id), [id], (set) => {
    const t = setInterval(() => driving.trip(id).then(set).catch(() => {}), 3000)
    return () => clearInterval(t)
  })
  const step = useAction(driving.step)
  const release = useAction(driving.release)
  const [eta, setEta] = useState(10)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/drive'))
  // Pendant la course, le téléphone envoie sa position ; le passager la voit en direct.
  const shared = useShareLocation(trip.data)
  const t0 = trip.data
  const near = shared ? { lat: +shared.point.lat.toFixed(3), lng: +shared.point.lng.toFixed(3) } : null
  const approach = useRoute(t0?.status === 'on_the_way' ? near : null, t0?.pickup.point)
  const tripRoute = useRoute(t0?.pickup.point, t0?.destination.point)

  if (trip.loading && !trip.data) return <Loading label="Loading the ride…" />
  if (trip.error || !trip.data) return <Screen title="Ride" onBack={back}><ErrorBlock message={trip.error?.message ?? 'Ride not found.'} onRetry={trip.reload} /></Screen>
  const t = trip.data
  const n = next[t.status]
  const toPickup = t.status === 'confirmed' || t.status === 'on_the_way' || t.status === 'arrived'
  const go = async () => {
    if (!n) return
    const r = await step.run(t.id, n.to, n.to === 'on_the_way' ? eta : undefined)
    if (r) { haptic.success(); trip.reload() }
  }

  if (t.status === 'completed' || t.status === 'cancelled' || t.status === 'pending') {
    const done = t.status === 'completed'
    return (
      <Screen title={`Ride ${t.code}`} onBack={() => router.replace('/drive')}>
        <EmptyState icon={done ? BadgeCheck : Ban} title={done ? 'Ride complete' : t.status === 'pending' ? 'Ride given back' : 'Ride cancelled'}
          body={done ? (t.payment === 'cash' ? `Collect ${formatUSD(t.priceCents)} in cash from ${t.fullName.split(' ')[0]}.` : `${formatUSD(t.priceCents)} will be paid to you with this week's card fares.`)
            : t.status === 'pending' ? 'Another driver can now confirm it.' : `${t.fullName.split(' ')[0]} cancelled this ride.`}
          action={<Button label="Back to dashboard" onPress={() => router.replace('/drive')} />} />
      </Screen>
    )
  }

  return (
    <Screen title={`Ride ${t.code}`} onBack={back} footer={<>
      {step.error ? <Banner kind="danger" title={step.error} /> : null}
      {n ? <Button label={n.to === 'on_the_way' ? `${n.label} · ${eta} min` : n.label} size="lg" fullWidth loading={step.busy} onPress={go} /> : null}
    </>}>
      <View style={{ height: 240, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
        <RideMap pickup={t.pickup.point} dropoff={toPickup && t.status !== 'confirmed' ? null : t.destination.point} driver={shared?.point}
          route={t.status === 'on_the_way' ? remaining(approach.route?.route, shared?.point) : t.status === 'arrived' ? null : t.status === 'in_progress' ? remaining(tripRoute.route?.route, shared?.point) : tripRoute.route?.route}
          label={toPickup ? `Heading to ${t.pickup.name}` : `Driving to ${t.destination.name}`}>
          {shared ? (
            <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.pill, backgroundColor: color('bg') }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color(shared.mode === 'gps' ? 'success' : 'warning') }} />
              <Text variant="xs" weight={600}>{shared.mode === 'gps' ? 'Sharing live location' : 'Simulated drive (GPS outside service area)'}</Text>
            </View>
          ) : null}
        </RideMap>
      </View>
      <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
        <Eyebrow tone="accent">{statusLabel[t.status]}</Eyebrow>
        <Text variant="xl" heading>{t.status === 'confirmed' ? `Pickup ${formatWhen(t.pickupAt)}` : t.status === 'on_the_way' ? `Heading to ${t.pickup.name}` : t.status === 'arrived' ? `Waiting for ${t.fullName.split(' ')[0]}` : `Driving to ${t.destination.name}`}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <Avatar name={t.fullName} size="lg" />
        <View style={{ flex: 1 }}>
          <Text weight={600}>{t.fullName}</Text>
          <Text variant="sm" tone="muted">{formatUsPhone(t.phone)} · {t.passengers} pax</Text>
        </View>
        <Button label="Call" variant="secondary" icon={Phone} onPress={() => Linking.openURL(`tel:${t.phone}`).catch(() => {})} />
      </View>

      {t.status === 'confirmed' ? (
        <View style={{ gap: 8 }}>
          <Text variant="sm" weight={500}>When you leave, tell {t.fullName.split(' ')[0]} your arrival time</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ETAS.map((m) => <Chip key={m} label={`${m} min`} selected={eta === m} onPress={() => setEta(m)} />)}
          </View>
          <Text variant="xs" tone="subtle">They see your name, car, plate and arrival time in their app.</Text>
        </View>
      ) : null}
      {t.status === 'arrived' ? <Banner kind="info" title={`Let ${t.fullName.split(' ')[0]} know you're outside`} body="Start the ride once everyone is on board." /> : null}

      <View style={{ gap: 10, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <RouteSummary from={t.pickup.name} to={t.destination.name} meta={`${formatMiles(t.distanceM)} · ${formatMinutes(t.durationS)}`} />
        <Divider />
        <Row label="Pickup" value={formatWhen(t.pickupAt)} />
        <Row label="Booking" value={`${vehicle(t.vehicle).tag} · ${t.tripType}`} />
        {t.notes ? <Row label="Notes" value={t.notes} /> : null}
        <Row label={t.payment === 'cash' ? 'Collect in cash' : 'Paid by card'} value={formatUSD(t.priceCents)} strong />
      </View>

      {t.status === 'confirmed' || t.status === 'on_the_way' ? (confirmRelease ? (
        <View style={{ gap: 8 }}>
          <Banner kind="danger" title="Give this ride back?" body="It goes back to the other drivers. Dispatch is notified." />
          {release.error ? <Banner kind="danger" title={release.error} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Give it back" variant="danger" loading={release.busy} onPress={async () => { if ((await release.attempt(t.id)).ok) { haptic.warning(); router.replace('/drive') } }} />
            <Button label="Keep the ride" variant="secondary" onPress={() => setConfirmRelease(false)} />
          </View>
        </View>
      ) : <Button label="I can't make it" variant="ghost" fullWidth onPress={() => setConfirmRelease(true)} />) : null}
    </Screen>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text variant="sm" tone="muted">{label}</Text>
      <Text variant={strong ? 'lg' : 'sm'} weight={strong ? 700 : 500} style={{ flexShrink: 1, textAlign: 'right' }} tabular={strong}>{value}</Text>
    </View>
  )
}
