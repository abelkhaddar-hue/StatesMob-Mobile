import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ChevronRight, History, Inbox, Timer } from 'lucide-react-native'
import { vehicle } from '@/data/fleet'
import { formatMiles, formatUSD } from '@/data/places'
import { driver, driving, type Board, type DriverAccount } from '@/data/driver'
import { formatWhen, statusLabel, type Trip } from '@/data/trips'
import { useAction, useLoad } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { ErrorBlock, Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { Banner, EmptyState, ListGroup, ListRow } from '@/ui/primitives'
import { RouteSummary } from '@/ui/trip'
import { haptic } from '@/ui/haptics'
import { Eyebrow } from '@/ui/sm'

const firstName = (full: string) => full.split(' ')[0]

// Tableau du chauffeur : ses courses confirmées, puis les réservations en attente qu'il peut prendre.
export default function DriverBoard() {
  const me = useLoad<DriverAccount | null>(driving.me, [])
  const [board, setBoard] = useState<Board>()
  const [error, setError] = useState<string>()
  const refresh = useCallback(() => driving.board().then((b) => { setBoard(b); setError(undefined) }).catch((e) => setError(e.message)), [])

  useFocusEffect(useCallback(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh]))

  if (me.loading && !me.data) return <Loading label="Loading your dashboard…" />
  if (!me.data) {
    return (
      <Screen title="Driver dashboard">
        <EmptyState icon={Inbox} title="Apply to drive first" body="Register your vehicle. Your dashboard opens once you're verified."
          action={<Button label="Become a driver" onPress={() => router.replace('/driver')} />} />
      </Screen>
    )
  }
  const d = me.data
  const verified = board?.verified ?? d.verified
  return (
    <Screen title="Driver dashboard" onBack={() => router.dismissTo('/')}>
      <View style={{ gap: 2 }}>
        <Text variant="xl" heading>Hi {d.firstName}</Text>
        <Text variant="sm" tone="muted">{d.vehicle.color} {d.vehicle.make} {d.vehicle.model} · {d.vehicle.plate} · {d.classes.map((c) => vehicle(c).tag).join(', ')}</Text>
      </View>

      {!verified ? (
        <Banner kind="warning" title="Pending verification" body="Only verified drivers can confirm rides. This normally means your background check hasn't come back yet." />
      ) : null}
      {error && !board ? <ErrorBlock message={error} onRetry={refresh} /> : null}

      {board?.mine.length ? (
        <View style={{ gap: 10 }}>
          <Eyebrow tone="accent">Your rides</Eyebrow>
          {board.mine.map((t) => <MyRide key={t.id} t={t} />)}
        </View>
      ) : null}

      {verified ? (
        <View style={{ gap: 10 }}>
          <Eyebrow>{board ? `Pending ride requests · ${board.open.length}` : 'Pending ride requests'}</Eyebrow>
          {board && !board.open.length ? (
            <EmptyState icon={Timer} title="No pending requests right now" body="New bookings that fit your vehicle show up here. Keep this screen open." />
          ) : null}
          {board?.open.map((t) => <Request key={t.id} t={t} onDone={refresh} />)}
        </View>
      ) : null}

      <ListGroup>
        <ListRow icon={History} label="Ride history" detail="Earnings and passenger ratings" onPress={() => router.push('/drive/history')} />
      </ListGroup>
      <Button label="Sign out of driver mode" variant="ghost" fullWidth onPress={() => { driver.clear(); router.dismissTo('/') }} />
    </Screen>
  )
}

function MyRide({ t }: { t: Trip }) {
  return (
    <Touchable onPress={() => router.push(`/drive/trip/${t.id}`)} accessibilityRole="button" accessibilityLabel={`${statusLabel[t.status]}, ${formatWhen(t.pickupAt)}, ${t.fullName}. Open`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: color('accent'), backgroundColor: pressed ? color('surface-2') : color('accent-soft') })}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="xs" weight={600} tone="on-accent-soft">{statusLabel[t.status]} · {formatWhen(t.pickupAt)}</Text>
        <Text weight={600} numberOfLines={1}>{firstName(t.fullName)} · {t.pickup.name} → {t.destination.name}</Text>
      </View>
      <ChevronRight size={20} color={color('on-accent-soft')} />
    </Touchable>
  )
}

function Request({ t, onDone }: { t: Trip; onDone: () => void }) {
  const accept = useAction(driving.accept)
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: color('surface'), borderWidth: 1, borderColor: color('border') }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight={600}>{formatWhen(t.pickupAt)}</Text>
          <Text variant="sm" tone="muted">{firstName(t.fullName)} · {t.passengers} pax · {t.tripType}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="xl" tabular>{formatUSD(t.priceCents)}</Text>
          <Text variant="xs" tone="subtle">{t.payment === 'cash' ? 'Collect cash' : 'Paid by card'}</Text>
        </View>
      </View>
      <RouteSummary from={t.pickup.name} to={t.destination.name} meta={formatMiles(t.distanceM)} />
      <Text variant="xs" tone="muted">{vehicle(t.vehicle).tag}{t.fixedRate ? ' · fixed airport rate' : ''}{t.notes ? ` · “${t.notes}”` : ''}</Text>
      {accept.error ? <Banner kind="danger" title={accept.error} /> : null}
      <Button label="Confirm ride" fullWidth loading={accept.busy} onPress={async () => {
        const r = await accept.run(t.id)
        if (r) { haptic.success(); onDone(); router.push(`/drive/trip/${r.id}`) }
      }} />
    </View>
  )
}
