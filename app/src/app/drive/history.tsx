import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ChevronRight, Milestone, Star } from 'lucide-react-native'
import { driving } from '@/data/driver'
import { formatMiles, formatUSD } from '@/data/places'
import { formatWhen, isActive, statusLabel, type Trip } from '@/data/trips'
import { color, tokens } from '@/theme'
import { ErrorBlock, Screen, Skeleton } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { EmptyState } from '@/ui/primitives'
import { Eyebrow } from '@/ui/sm'

const open = (t: Trip) => t.status === 'confirmed' || isActive(t.status)
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

function RideRow({ t }: { t: Trip }) {
  const cancelled = t.status === 'cancelled'
  const body = (
    <>
      <View style={{ flex: 1, gap: 4 }}>
        <Eyebrow tone={open(t) ? 'accent' : 'muted'}>{statusLabel[t.status]}</Eyebrow>
        <Text weight={600} numberOfLines={1}>{t.fullName.split(' ')[0]} · {t.destination.name}</Text>
        <Text variant="sm" tone="muted" numberOfLines={1}>from {t.pickup.name} · {formatMiles(t.distanceM)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="xs" tone="muted">{formatWhen(t.pickupAt)} · {t.payment === 'cash' ? 'Cash' : 'Card'}</Text>
          {t.stars ? <><Star size={12} color={color('star')} fill={color('star')} /><Text variant="xs" tone="muted">{t.stars}</Text></> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text weight={600} tabular style={cancelled ? { textDecorationLine: 'line-through', color: color('text-muted') } : undefined}>{formatUSD(t.priceCents)}</Text>
        {open(t) ? <ChevronRight size={18} color={color('text-muted')} /> : null}
      </View>
    </>
  )
  const label = `${statusLabel[t.status]}, ${formatWhen(t.pickupAt)}, ${t.fullName}, ${t.pickup.name} to ${t.destination.name}, ${formatUSD(t.priceCents)}${t.stars ? `, rated ${t.stars} stars` : ''}`
  const box = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg } as const
  // Course en cours : on la reprend. Courses passées : simple ligne d'historique.
  return open(t) ? (
    <Touchable onPress={() => router.push(`/drive/trip/${t.id}`)} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ ...box, backgroundColor: pressed ? color('surface-2') : color('surface') })}>{body}</Touchable>
  ) : (
    <View accessible accessibilityLabel={label} style={{ ...box, backgroundColor: color('surface') }}>{body}</View>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="lg" heading tabular>{value}</Text>
      <Text variant="xs" tone="subtle">{label}</Text>
    </View>
  )
}

// Historique chauffeur : gains, courses terminées, note reçue, puis la liste des courses.
export default function DriveHistory() {
  const [items, setItems] = useState<Trip[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(() => driving.history().then((v) => { setItems(v); setError(null) }).catch((e) => setError(e.message)), [])

  useFocusEffect(useCallback(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [refresh]))

  const list = items ?? []
  const done = list.filter((t) => t.status === 'completed')
  const earned = done.reduce((s, t) => s + t.priceCents, 0)
  const today = done.filter((t) => sameDay(t.completedAt ?? t.pickupAt)).reduce((s, t) => s + t.priceCents, 0)
  const rated = done.filter((t) => t.stars)
  const avg = rated.length ? rated.reduce((s, t) => s + (t.stars ?? 0), 0) / rated.length : 0
  const now = list.filter(open)
  const past = list.filter((t) => !open(t))

  return (
    <Screen title="Ride history">
      {error && !items ? <ErrorBlock message={error} onRetry={refresh} /> : null}
      {!items && !error ? <><Skeleton height={88} /><Skeleton /><Skeleton /></> : null}
      {items && !items.length ? (
        <EmptyState icon={Milestone} title="No rides yet" body="Rides you confirm show up here with what you earned and how passengers rated you."
          action={<Button label="See ride requests" onPress={() => router.replace('/drive')} />} />
      ) : null}
      {items?.length ? (
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
          <Stat value={formatUSD(earned)} label="Earned" />
          <Stat value={formatUSD(today)} label="Today" />
          <Stat value={String(done.length)} label={done.length === 1 ? 'Ride' : 'Rides'} />
          <Stat value={avg ? avg.toFixed(1) : '–'} label="Rating" />
        </View>
      ) : null}
      {now.length ? <View style={{ gap: 10 }}><Eyebrow tone="accent">Upcoming</Eyebrow>{now.map((t) => <RideRow key={t.id} t={t} />)}</View> : null}
      {past.length ? <View style={{ gap: 10 }}><Eyebrow>Past rides</Eyebrow>{past.map((t) => <RideRow key={t.id} t={t} />)}</View> : null}
    </Screen>
  )
}
