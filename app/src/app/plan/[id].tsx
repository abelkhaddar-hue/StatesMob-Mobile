import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ban, CalendarCheck } from 'lucide-react-native'
import { formatUSD } from '@/data/places'
import { DAYS, formatClock, plans, type Plan } from '@/data/trips'
import { useAction, useLoad } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { ErrorBlock, Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Divider, EmptyState } from '@/ui/primitives'
import { RouteSummary, SearchingPulse, StatusSteps } from '@/ui/trip'
import { haptic } from '@/ui/haptics'
import { CallButton, Eyebrow } from '@/ui/sm'

// Les 5 prochains trajets d'un abonnement actif (aller le matin, retour le soir).
function upcoming(p: Plan) {
  const out: { day: Date; morning: string; evening: string }[] = []
  const now = new Date()
  for (let i = 0; out.length < 5 && i < 14; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    if (p.days.includes(DAYS[(day.getDay() + 6) % 7])) out.push({ day, morning: p.morningTime, evening: p.eveningTime })
  }
  return out
}

// Suivi de l'abonnement : demande envoyée → tarif proposé → actif.
export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const plan = useLoad<Plan>(() => plans.get(id), [id], (set) => {
    const t = setInterval(() => plans.get(id).then(set).catch(() => {}), 3000)
    return () => clearInterval(t)
  })
  const accept = useAction(plans.accept)
  const cancel = useAction(plans.cancel)
  const [confirm, setConfirm] = useState(false)

  if (plan.loading && !plan.data) return <Loading label="Loading your plan…" />
  if (plan.error || !plan.data) return <Screen title="Weekly ride"><ErrorBlock message={plan.error?.message ?? 'Plan not found.'} onRetry={plan.reload} /></Screen>
  const p = plan.data
  const at = { pending: 0, quoted: 1, active: 2, cancelled: 0 }[p.status]

  return (
    <Screen title={`Weekly ride ${p.code}`} onBack={() => (router.canGoBack() ? router.back() : router.replace('/trips'))} footer={
      p.status === 'quoted' ? <>
        {accept.error ? <Banner kind="danger" title={accept.error} /> : null}
        <Button label="Start my weekly ride" trailing={`${formatUSD(p.pricePerWeekCents!)}/wk`} size="lg" fullWidth loading={accept.busy}
          onPress={async () => { if (await accept.run(p.id)) { haptic.success(); plan.reload() } }} />
      </> : undefined
    }>
      {p.status === 'cancelled' ? (
        <EmptyState icon={Ban} title="Plan cancelled" body="This weekly ride is no longer scheduled." action={<Button label="Set up a new one" onPress={() => router.replace('/weekly')} />} />
      ) : (
        <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
          <Eyebrow tone="accent">{p.status === 'pending' ? 'Request received' : p.status === 'quoted' ? 'Your rate is ready' : 'Active'}</Eyebrow>
          <Text variant="xl" heading>{p.status === 'pending' ? "We're preparing your weekly rate" : p.status === 'quoted' ? `${formatUSD(p.pricePerWeekCents!)} per week` : 'Your weekly ride is on'}</Text>
          <Text tone="muted">{p.status === 'pending' ? 'Dispatch reviews your route and schedule. In this demo, about 20 seconds.' : p.status === 'quoted' ? 'Billed weekly, cancel anytime. Start it to lock in your driver.' : 'Your driver texts you each morning before pickup.'}</Text>
        </View>
      )}

      {p.status === 'pending' ? <SearchingPulse label="Reviewing your schedule" /> : null}

      {p.status !== 'cancelled' ? (
        <StatusSteps at={at} steps={[{ label: 'Request sent' }, { label: 'Weekly rate ready' }, { label: 'Rides scheduled' }]} />
      ) : null}

      {p.status === 'active' ? (
        <View style={{ gap: 10 }}>
          <Eyebrow>Next rides</Eyebrow>
          {upcoming(p).map((r) => (
            <View key={r.day.toISOString()} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: tokens.radius.md, backgroundColor: color('surface') }}>
              <CalendarCheck size={18} color={color('accent')} />
              <Text weight={600} style={{ flex: 1 }}>{r.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
              <Text variant="sm" tone="muted">{formatClock(r.morning)} · {formatClock(r.evening)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <RouteSummary from={`Home · ${p.home.name}`} to={`Work · ${p.work.name}`} />
        <Divider />
        <Row label="Days" value={p.days.join(', ')} />
        <Row label="Morning pickup" value={formatClock(p.morningTime)} />
        <Row label="Return home" value={formatClock(p.eveningTime)} />
        <Row label="Passengers" value={String(p.passengers)} />
        {p.notes ? <Row label="Notes" value={p.notes} /> : null}
      </View>

      {p.status !== 'cancelled' ? (confirm ? (
        <View style={{ gap: 8 }}>
          <Banner kind="danger" title="Cancel your weekly ride?" body="Rides already scheduled this week are cancelled too." />
          {cancel.error ? <Banner kind="danger" title={cancel.error} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Yes, cancel" variant="danger" loading={cancel.busy} onPress={async () => { if ((await cancel.attempt(p.id)).ok) { haptic.warning(); plan.reload() } }} />
            <Button label="Keep it" variant="secondary" onPress={() => setConfirm(false)} />
          </View>
        </View>
      ) : <Button label={p.status === 'active' ? 'Cancel weekly ride' : 'Withdraw request'} variant="ghost" fullWidth onPress={() => setConfirm(true)} />) : null}
      <CallButton />
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text variant="sm" tone="muted">{label}</Text>
      <Text variant="sm" weight={500} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}
