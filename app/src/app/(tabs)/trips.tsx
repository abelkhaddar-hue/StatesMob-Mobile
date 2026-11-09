import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ChevronRight, Repeat, Route, Star } from 'lucide-react-native'
import { vehicle } from '@/data/fleet'
import { formatUSD } from '@/data/places'
import { formatClock, formatWhen, isUpcoming, plans, statusLabel, trips, type Plan, type Trip } from '@/data/trips'
import { color, tokens } from '@/theme'
import { TabScreen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { Banner, EmptyState } from '@/ui/primitives'
import { Eyebrow } from '@/ui/sm'

function TripRow({ t }: { t: Trip }) {
  const cancelled = t.status === 'cancelled'
  return (
    <Touchable onPress={() => router.push(`/trip/${t.id}`)} accessibilityRole="button"
      accessibilityLabel={`${statusLabel[t.status]}, ${formatWhen(t.pickupAt)}, ${t.pickup.name} to ${t.destination.name}, ${formatUSD(t.priceCents)}${t.stars ? `, rated ${t.stars} stars` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: pressed ? color('surface-2') : color('surface') })}>
      <View style={{ flex: 1, gap: 4 }}>
        <Eyebrow tone={isUpcoming(t.status) ? 'accent' : 'muted'}>{statusLabel[t.status]}</Eyebrow>
        <Text weight={600} numberOfLines={1}>{t.destination.name}</Text>
        <Text variant="sm" tone="muted" numberOfLines={1}>from {t.pickup.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="xs" tone="muted">{formatWhen(t.pickupAt)} · {vehicle(t.vehicle).tag}{t.driver ? ` · ${t.driver.firstName}` : ''}</Text>
          {t.stars ? <><Star size={12} color={color('star')} fill={color('star')} /><Text variant="xs" tone="muted">{t.stars}</Text></> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text weight={600} tabular style={cancelled ? { textDecorationLine: 'line-through', color: color('text-muted') } : undefined}>{formatUSD(t.priceCents)}</Text>
        <ChevronRight size={18} color={color('text-muted')} />
      </View>
    </Touchable>
  )
}

function PlanRow({ p }: { p: Plan }) {
  const label = { pending: 'Rate in preparation', quoted: 'Rate ready · tap to start', active: 'Active', cancelled: 'Cancelled' }[p.status]
  return (
    <Touchable onPress={() => router.push(`/plan/${p.id}`)} accessibilityRole="button" accessibilityLabel={`Weekly ride, ${label}, ${p.days.join(' ')}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg, borderWidth: 1,
        borderColor: color(p.status === 'quoted' ? 'accent' : 'border'), backgroundColor: pressed ? color('surface-2') : color('surface') })}>
      <Repeat size={22} color={color(p.status === 'cancelled' ? 'text-subtle' : 'accent')} />
      <View style={{ flex: 1, gap: 2 }}>
        <Eyebrow tone={p.status === 'cancelled' ? 'muted' : 'accent'}>{label}</Eyebrow>
        <Text weight={600} numberOfLines={1}>{p.home.name} ⇄ {p.work.name}</Text>
        <Text variant="xs" tone="muted">{p.days.join(' ')} · {formatClock(p.morningTime)} and {formatClock(p.eveningTime)}</Text>
      </View>
      {p.pricePerWeekCents ? <Text weight={600} tabular>{formatUSD(p.pricePerWeekCents)}/wk</Text> : null}
      <ChevronRight size={18} color={color('text-muted')} />
    </Touchable>
  )
}

// « My trips » : à venir, abonnement semaine, puis l'historique.
export default function Trips() {
  const [items, setItems] = useState<Trip[] | null>(null)
  const [weekly, setWeekly] = useState<Plan[]>([])
  const [error, setError] = useState<string>()
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    try { const [t, p] = await Promise.all([trips.mine(), plans.mine()]); setItems(t); setWeekly(p); setError(undefined) }
    catch (e) { setError((e as Error).message) }
  }, [])

  useFocusEffect(useCallback(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [refresh]))

  const list = items ?? []
  const next = list.filter((t) => isUpcoming(t.status)).sort((a, b) => Date.parse(a.pickupAt) - Date.parse(b.pickupAt))
  const past = list.filter((t) => !isUpcoming(t.status))
  const openPlans = weekly.filter((p) => p.status !== 'cancelled')

  return (
    <TabScreen title="My trips" refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false) }}>
      {error && !items ? <Banner kind="danger" title="Could not load your trips" body={error} /> : null}
      {items && !list.length && !weekly.length ? (
        <EmptyState icon={Route} title="No trips yet" body="Book a ride or a weekly commute: everything you book shows up here."
          action={<Button label="Book a ride" onPress={() => router.navigate('/')} />} />
      ) : null}
      {next.length ? <View style={{ gap: 10 }}><Eyebrow tone="accent">Upcoming</Eyebrow>{next.map((t) => <TripRow key={t.id} t={t} />)}</View> : null}
      {openPlans.length ? <View style={{ gap: 10 }}><Eyebrow tone="accent">Weekly ride</Eyebrow>{openPlans.map((p) => <PlanRow key={p.id} p={p} />)}</View> : null}
      {past.length ? <View style={{ gap: 10 }}><Eyebrow>Past trips</Eyebrow>{past.map((t) => <TripRow key={t.id} t={t} />)}</View> : null}
    </TabScreen>
  )
}
