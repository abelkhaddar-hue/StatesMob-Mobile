import { useState } from 'react'
import { Linking, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ban, BadgeCheck, Phone } from 'lucide-react-native'
import { vehicle } from '@/data/fleet'
import { fakeRoute, formatMiles, formatMinutes, formatUSD } from '@/data/places'
import { driving, type DriverStep } from '@/data/driver'
import { driverPosition, formatWhen, statusLabel, type Trip } from '@/data/trips'
import { useAction, useLoad } from '@/data/hooks'
import { formatUsPhone } from '@/data/booking'
import { color, tokens } from '@/theme'
import { ErrorBlock, Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Avatar, Banner, Chip, Divider, EmptyState } from '@/ui/primitives'
import { FakeMap } from '@/ui/map'
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
      <View style={{ height: 180, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
        <FakeMap pickup={t.pickup.point} dropoff={toPickup ? null : t.destination.point} driver={driverPosition(t)}
          route={toPickup ? null : fakeRoute(t.pickup.point, t.destination.point)} label={toPickup ? `Heading to ${t.pickup.name}` : `Driving to ${t.destination.name}`} />
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
