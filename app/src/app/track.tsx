import { useState } from 'react'
import { View } from 'react-native'
import { SearchX } from 'lucide-react-native'
import { booking, formatUsPhone } from '@/data/booking'
import { formatWhen, minutesAway, statusLabel, trips, type TrackResult, type Trip } from '@/data/trips'
import { useAction } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Banner, EmptyState, PlateBadge } from '@/ui/primitives'
import { RouteSummary } from '@/ui/trip'
import { CallButton, Eyebrow } from '@/ui/sm'

// « Track Your Ride » du site : retrouver une réservation avec le numéro de téléphone donné à la commande.
export default function Track() {
  const saved = booking.savedContact()
  const [phone, setPhone] = useState(saved ? formatUsPhone(saved.phone) : '')
  const [result, setResult] = useState<TrackResult>()
  const look = useAction(trips.track)
  const run = async () => { setResult(undefined); const r = await look.run(phone); if (r) setResult(r) }

  return (
    <Screen title="Track your ride">
      <Text tone="muted">Enter the phone number you used to book. Works for rides booked on the website or by phone too.</Text>
      <Field label="Phone number" value={phone} onChangeText={(v) => { setPhone(formatUsPhone(v)); look.setError(undefined) }} error={look.error}
        placeholder="513-000-0000" keyboardType="phone-pad" autoComplete="tel" returnKeyType="search" onSubmitEditing={run} />
      <Button label="Track" size="lg" fullWidth loading={look.busy} onPress={run} />

      {result && !result.found ? (
        <EmptyState icon={SearchX} title="No reservation found" body="Check the number, or call dispatch and we'll look it up." />
      ) : null}

      {result?.found ? (
        <View style={{ gap: 12, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }} accessibilityLiveRegion="polite">
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: tokens.radius.pill,
            backgroundColor: color(result.status === 'pending' ? 'warning-soft' : result.status === 'cancelled' ? 'danger-soft' : 'accent-soft') }}>
            <Text variant="xs" weight={600} style={{ color: color(result.status === 'pending' ? 'warning' : result.status === 'cancelled' ? 'danger' : 'on-accent-soft') }}>
              {result.status === 'pending' ? 'Pending — awaiting driver' : statusLabel[result.status]}
            </Text>
          </View>
          <RouteSummary from={result.pickup} to={result.destination} />
          <Text variant="xs" tone="muted">{formatWhen(result.pickupAt)} · {result.tripType} · {result.code}</Text>
          {result.driver ? (
            <View style={{ gap: 8, padding: 12, borderRadius: tokens.radius.md, backgroundColor: color('bg') }}>
              <Eyebrow>Your driver</Eyebrow>
              <Text>
                {result.status === 'on_the_way'
                  ? `${result.driver.name} is arriving in ${minutesAway({ status: 'on_the_way', onTheWayAt: result.onTheWayAt, etaMinutes: result.etaMinutes } as Trip)} minutes, driving a ${result.driver.carColor} ${result.driver.carMake} ${result.driver.carModel}. Safe travels!`
                  : `${result.driver.name}, ${result.driver.carColor} ${result.driver.carMake} ${result.driver.carModel}.`}
              </Text>
              <PlateBadge plate={result.driver.plate} />
            </View>
          ) : result.status === 'pending' ? (
            <Banner kind="info" title="No driver yet" body="You'll get a text with your driver's name, car and arrival time as soon as a driver confirms." />
          ) : null}
        </View>
      ) : null}
      <CallButton />
    </Screen>
  )
}
