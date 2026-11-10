import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { CalendarDays, Users } from 'lucide-react-native'
import { ApiError } from '@/data/booking'
import { fleet, quote, tripTypes, type Quote } from '@/data/fleet'
import { draft, useDraft } from '@/data/draft'
import { formatMiles, formatMinutes, formatUSD } from '@/data/places'
import { formatWhen } from '@/data/trips'
import { useRoute } from '@/data/hooks'
import { RideMap } from '@/ui/map'
import { color, tokens } from '@/theme'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Chip } from '@/ui/primitives'
import { RouteSummary, VehicleCard } from '@/ui/trip'
import { Eyebrow } from '@/ui/sm'

// Choix du véhicule (prix de chacun) et du type de trajet.
export default function ChooseVehicle() {
  const d = useDraft()
  const r = useRoute(d.pickup?.point, d.dropoff?.point)
  const quotes = useMemo((): { list?: Quote[]; error?: string } => {
    if (!d.pickup || !d.dropoff) return { error: 'Choose a pickup and a destination.' }
    if (!r.route) return {}
    try { return { list: fleet.map((v) => quote(d.pickup!, d.dropoff!, v.code, r.route!)) } } catch (e) { return { error: e instanceof ApiError ? e.message : String(e) } }
  }, [d.pickup, d.dropoff, r.route])
  const list: Quote[] = quotes.list ?? []
  const fits = (code: string) => fleet.find((v) => v.code === code)!.seats >= d.passengers
  const chosen = list.find((q) => q.vehicle === d.vehicle && fits(q.vehicle))

  // Un trajet vers ou depuis CVG est un transfert aéroport.
  useEffect(() => { if (list[0]?.fixedRate && draft.get().tripType === 'Local Ride') draft.set({ tripType: 'Airport Transfer' }) }, [list[0]?.fixedRate])

  return (
    <Screen title="Choose your vehicle" footer={
      <Button label="Continue" trailing={chosen ? formatUSD(chosen.priceCents) : undefined} size="lg" fullWidth disabled={!chosen} onPress={() => router.push('/book/details')} />
    }>
      {d.pickup && d.dropoff ? (
        <View style={{ height: 180, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
          <RideMap pickup={d.pickup.point} dropoff={d.dropoff.point} route={r.route?.route} label={`Route from ${d.pickup.name} to ${d.dropoff.name}`} />
        </View>
      ) : null}
      <View style={{ gap: 10, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <RouteSummary from={d.pickup?.name ?? '—'} to={d.dropoff?.name ?? '—'} meta={list[0] ? `${formatMiles(list[0].distanceM)} · ${formatMinutes(list[0].durationS)}` : undefined} />
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><CalendarDays size={14} color={color('text-muted')} /><Text variant="sm" tone="muted">{d.pickupAt ? formatWhen(d.pickupAt) : 'No time yet'}</Text></View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Users size={14} color={color('text-muted')} /><Text variant="sm" tone="muted">{d.passengers} {d.passengers === 1 ? 'passenger' : 'passengers'}</Text></View>
        </View>
      </View>

      {quotes.error ? <Banner kind="danger" title={quotes.error} /> : null}
      {r.loading && !list.length ? <Text tone="muted" center>Calculating prices from the route…</Text> : null}
      {r.route?.estimated ? <Text variant="xs" tone="subtle">Route service unavailable: distance is estimated. Dispatch confirms the final fare.</Text> : null}

      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {list.map((q) => {
          const ok = fits(q.vehicle)
          return (
            <VehicleCard key={q.vehicle} code={q.vehicle} price={formatUSD(q.priceCents)} fixed={q.fixedRate} selected={ok && d.vehicle === q.vehicle}
              disabled={!ok} note={ok ? undefined : 'Too small'} onPress={() => draft.set({ vehicle: q.vehicle })} />
          )
        })}
      </View>
      {list[0]?.fixedRate ? <Text variant="sm" tone="muted">Airport transfers to or from CVG have a fixed rate. Tolls and parking are included.</Text> : null}

      <View style={{ gap: 10 }}>
        <Eyebrow>Trip type</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tripTypes.map((t) => <Chip key={t} label={t} selected={d.tripType === t} onPress={() => draft.set({ tripType: t })} />)}
        </View>
        {d.tripType === 'Hourly Service' ? <Text variant="sm" tone="muted">Hourly service: this is the price for the ride. Dispatch confirms the hourly rate by phone.</Text> : null}
      </View>
    </Screen>
  )
}
