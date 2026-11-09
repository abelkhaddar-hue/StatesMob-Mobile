import { useEffect, useState } from 'react'
import { Linking, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ban, BadgeCheck } from 'lucide-react-native'
import { vehicle, payLabel } from '@/data/fleet'
import { fakeRoute, formatUSD } from '@/data/places'
import { carLine, driverName, driverPosition, formatWhen, minutesAway, statusLabel, trips, type Trip } from '@/data/trips'
import { useAction, useLoad } from '@/data/hooks'
import { DISPATCH_PHONE } from '@/data/booking'
import { color, tokens } from '@/theme'
import { ErrorBlock, Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Divider, EmptyState } from '@/ui/primitives'
import { FakeMap } from '@/ui/map'
import { DriverCard, RouteSummary, SearchingPulse, StarRating, StatusSteps } from '@/ui/trip'
import { haptic } from '@/ui/haptics'
import { CallButton, Eyebrow } from '@/ui/sm'

const order = ['pending', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed'] as const

// Suivi d'une réservation : en attente d'un chauffeur, confirmée, chauffeur en route, sur place, en course, terminée.
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const trip = useLoad<Trip>(() => trips.get(id), [id], (set) => {
    const t = setInterval(() => trips.get(id).then(set).catch(() => {}), 3000)
    return () => clearInterval(t)
  })
  const status = trip.data?.status
  useEffect(() => { if (status && status !== 'pending') haptic.success() }, [status])

  if (trip.loading && !trip.data) return <Loading label="Loading your trip…" />
  if (trip.error || !trip.data) return <Screen title="Trip"><ErrorBlock message={trip.error?.message ?? 'Trip not found.'} onRetry={trip.reload} /></Screen>
  const t = trip.data
  return (
    <Screen title={`Trip ${t.code}`} onBack={() => (router.canGoBack() ? router.back() : router.replace('/trips'))}>
      <Body t={t} reload={trip.reload} />
    </Screen>
  )
}

function Body({ t, reload }: { t: Trip; reload: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const cancel = useAction(trips.cancel)
  const v = vehicle(t.vehicle)
  const d = t.driver
  const away = minutesAway(t)
  const toPickup = t.status === 'on_the_way' || t.status === 'arrived' || t.status === 'confirmed' || t.status === 'pending'
  const done = t.status === 'completed' || t.status === 'cancelled'
  const at = order.indexOf(t.status as (typeof order)[number])

  const headline: Record<Trip['status'], string> = {
    pending: 'Request received',
    confirmed: `${d?.firstName ?? 'Your driver'} will pick you up`,
    on_the_way: away ? `${d?.firstName} arrives in ${away} min` : `${d?.firstName} is on the way`,
    arrived: `${d?.firstName} is here`,
    in_progress: `On the way to ${t.destination.name}`,
    completed: 'You have arrived',
    cancelled: 'Trip cancelled',
  }

  return (
    <>
      {t.status === 'cancelled' ? (
        <EmptyState icon={Ban} title="Trip cancelled" body={t.cancelledBy === 'passenger' ? 'You cancelled this trip. You were not charged.' : 'This trip was cancelled. Call dispatch if you need a ride.'}
          action={<Button label="Book a new ride" onPress={() => router.navigate('/')} />} />
      ) : (
        <>
          <View style={{ height: 200, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
            <FakeMap pickup={t.pickup.point} dropoff={toPickup && t.status !== 'pending' && t.status !== 'confirmed' ? null : t.destination.point}
              driver={driverPosition(t)} route={toPickup ? (t.status === 'pending' || t.status === 'confirmed' ? fakeRoute(t.pickup.point, t.destination.point) : null) : fakeRoute(t.pickup.point, t.destination.point)}
              label={`Map: ${statusLabel[t.status]}`} />
          </View>
          <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
            <Eyebrow tone="accent">{statusLabel[t.status]}</Eyebrow>
            <Text variant="xl" heading>{headline[t.status]}</Text>
          </View>
        </>
      )}

      {t.status === 'pending' ? (
        <View style={{ gap: 12 }}>
          <SearchingPulse label="Dispatch is assigning a driver. You'll get a text with your driver's name, car and arrival time." />
        </View>
      ) : null}

      {d && !done ? (
        <View style={{ gap: 14, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
          <DriverCard name={driverName(d)} rating={d.rating} count={d.ratingsCount} vehicle={carLine(d)} plate={d.vehicle.plate}
            onCall={() => Linking.openURL(`tel:${d.phone}`).catch(() => {})} />
          {t.status === 'on_the_way' && away ? (
            <Text variant="sm" tone="muted">Your driver {driverName(d)} is arriving in {away} minutes, driving a {carLine(d)}, plate {d.vehicle.plate}. Safe travels!</Text>
          ) : null}
          {t.status === 'arrived' ? <Banner kind="success" title="Your driver is waiting" body={`Look for a ${carLine(d)}, plate ${d.vehicle.plate}.`} /> : null}
        </View>
      ) : null}

      {t.status === 'completed' ? <RateBlock t={t} /> : null}

      {t.status !== 'cancelled' && t.status !== 'completed' ? (
        <StatusSteps at={at} steps={[
          { label: 'Request received', body: 'Waiting for a driver to confirm.' },
          { label: 'Driver confirmed', body: `Pickup ${formatWhen(t.pickupAt)}. We'll let you know when they leave.` },
          { label: 'Driver on the way' },
          { label: 'Driver at pickup' },
          { label: 'On the road' },
          { label: 'Arrived' },
        ]} />
      ) : null}

      <View style={{ gap: 10, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <RouteSummary from={t.pickup.name} to={t.destination.name} />
        <Divider />
        <Row label="Pickup" value={formatWhen(t.pickupAt)} />
        <Row label="Vehicle" value={`${v.tag} · ${t.passengers} ${t.passengers === 1 ? 'passenger' : 'passengers'}`} />
        <Row label="Trip type" value={t.tripType} />
        <Row label="Payment" value={payLabel[t.payment]} />
        {t.notes ? <Row label="Notes" value={t.notes} /> : null}
        <Row label={t.fixedRate ? 'Fixed rate' : t.status === 'completed' ? 'Fare' : 'Estimated fare'} value={formatUSD(t.priceCents)} strong />
      </View>

      {t.status === 'pending' || t.status === 'confirmed' || t.status === 'on_the_way' ? (confirm ? (
        <View style={{ gap: 8 }}>
          <Banner kind="danger" title="Cancel this trip?" body={d ? `${d.firstName} will be told right away.` : 'Your request will be withdrawn.'} />
          {cancel.error ? <Banner kind="danger" title={cancel.error} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Yes, cancel" variant="danger" loading={cancel.busy} onPress={async () => { if ((await cancel.attempt(t.id)).ok) { haptic.warning(); reload() } }} />
            <Button label="Keep my trip" variant="secondary" onPress={() => setConfirm(false)} />
          </View>
        </View>
      ) : <Button label="Cancel trip" variant="ghost" fullWidth onPress={() => setConfirm(true)} />) : null}

      <CallButton />
      <Text variant="xs" tone="subtle" center>Booking {t.code} · Dispatch {DISPATCH_PHONE}</Text>
    </>
  )
}

function RateBlock({ t }: { t: Trip }) {
  const [stars, setStars] = useState(t.stars ?? 0)
  const rate = useAction(trips.rate)
  const [done, setDone] = useState(!!t.stars)
  if (done) {
    return <EmptyState icon={BadgeCheck} title="Thanks for riding with SafeMobility" body={`You rated ${t.driver?.firstName ?? 'your driver'} ${stars} star${stars > 1 ? 's' : ''}.`}
      action={<Button label="Book another ride" onPress={() => router.navigate('/')} />} />
  }
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
      <Text weight={600} center>How was your ride with {t.driver?.firstName ?? 'your driver'}?</Text>
      <StarRating value={stars} onChange={setStars} />
      {rate.error ? <Banner kind="danger" title={rate.error} /> : null}
      <Button label="Send rating" fullWidth disabled={!stars} loading={rate.busy} onPress={async () => { if (await rate.run(t.id, stars)) { haptic.success(); setDone(true) } }} />
    </View>
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
