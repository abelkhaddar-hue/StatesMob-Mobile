import { ActivityIndicator, View } from 'react-native'
import { router } from 'expo-router'
import { BadgeCheck, CalendarCheck, CarFront, ClipboardCheck, Handshake, IdCard, Send, ShieldCheck, Signpost, UserCheck, Wallet, type LucideIcon } from 'lucide-react-native'
import { formatUsPhone } from '@/data/booking'
import { vehicle } from '@/data/fleet'
import { driver, driving, STEPS, type DriverAccount } from '@/data/driver'
import { useLoad } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { Loading, Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, PlateBadge } from '@/ui/primitives'
import { InfoRow } from '@/ui/driver'
import { CallButton, Eyebrow } from '@/ui/sm'

// Espace chauffeur : présentation avant la candidature, puis suivi de la vérification.
export default function DriverHome() {
  const a = driver.saved()
  if (!a?.submittedAt) return <Pitch step={a ? a.step : null} />
  return <Review />
}

function Pitch({ step }: { step: number | null }) {
  return (
    <Screen title="Drive with SafeMobility" footer={<>
      <Button label={step != null ? `Continue application · ${STEPS[step]}` : 'Start application'} size="lg" fullWidth onPress={() => router.push('/driver/apply')} />
      <Text variant="xs" tone="subtle" center>Takes about 10 minutes · Free to apply</Text>
    </>}>
      <View style={{ gap: 6 }}>
        <Eyebrow tone="accent">Driving for SafeMobility?</Eyebrow>
        <Text variant="xl" heading>Register your vehicle and start receiving ride requests.</Text>
        <Text tone="muted">Airport transfers, business clients and scheduled rides across Cincinnati and Northern Kentucky.</Text>
      </View>
      <View style={{ gap: 16 }}>
        <InfoRow icon={Signpost} title="Pick the rides you want" body="See pickup time, route, passengers and fare before you confirm." />
        <InfoRow icon={Handshake} title="Scheduled, not on-demand" body="Bookings come in ahead of time, so you can plan your day." />
        <InfoRow icon={Wallet} title="Cash in hand, card paid weekly" body="Collect cash fares at drop-off. Card fares are paid every week." />
      </View>
      <View style={{ gap: 14, backgroundColor: color('surface'), borderRadius: tokens.radius.lg, padding: 16 }}>
        <Text weight={600}>What you need</Text>
        <Requirement icon={CalendarCheck} label="21 or older" />
        <Requirement icon={IdCard} label="Valid US driver's license" />
        <Requirement icon={CarFront} label="4-door vehicle, 2012 or newer" />
        <Requirement icon={ShieldCheck} label="Insurance in your name" />
      </View>
      <Text variant="xs" tone="subtle">We never ask for your Social Security number in the app. Background checks run through our screening partner's secure page.</Text>
    </Screen>
  )
}

function Requirement({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <Icon size={tokens.size.icon} color={color('accent')} />
      <Text variant="sm">{label}</Text>
    </View>
  )
}

const stages: { label: string; icon: LucideIcon; body: string }[] = [
  { label: 'Application sent', icon: Send, body: 'We have everything we need.' },
  { label: 'Background check', icon: UserCheck, body: 'Look for an email from our screening partner. In this demo, under a minute.' },
  { label: 'Verified', icon: BadgeCheck, body: 'You can confirm rides.' },
]

function Review() {
  const me = useLoad<DriverAccount | null>(driving.me, [], (set) => { const t = setInterval(() => driving.me().then(set).catch(() => {}), 2000); return () => clearInterval(t) })
  if (me.loading && !me.data) return <Loading label="Loading your driver account…" />
  const d = me.data
  if (!d) {
    return (
      <Screen title="Driver application">
        <Banner kind="warning" title="We couldn't find your application" body="It may have been reset. Send it again from this device." />
        <Button label="Review my application" onPress={() => { const a = driver.open(); driver.save({ ...a, submittedAt: undefined, step: STEPS.length - 1 }); router.replace('/driver/apply') }} />
      </Screen>
    )
  }
  const at = d.verified ? 3 : 1
  return (
    <Screen title="Driver application" footer={d.verified
      ? <Button label="Open driver dashboard" icon={ClipboardCheck} size="lg" fullWidth onPress={() => router.replace('/drive')} />
      : <Button label="Back to the app" size="lg" fullWidth onPress={() => router.dismissTo('/')} />}>
      <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
        <Text variant="xl" heading>{d.verified ? `You're verified, ${d.firstName}!` : 'Pending verification'}</Text>
        <Text tone="muted">{d.verified ? 'Welcome to SafeMobility. Ride requests that fit your vehicle are waiting.' : 'Only verified drivers can confirm rides. This normally takes 1 to 3 business days.'}</Text>
      </View>

      <View>
        {stages.map((s, i) => {
          const done = i < at, current = i === at
          const Icon = s.icon
          return (
            <View key={s.label} accessible accessibilityLabel={`${s.label}, ${done ? 'done' : current ? 'in progress' : 'pending'}`} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color(done ? 'success' : current ? 'accent' : 'surface-2') }}>
                  {current ? <ActivityIndicator size="small" color={color('on-accent')} /> : <Icon size={18} color={color(done ? 'on-accent' : 'text-subtle')} />}
                </View>
                {i < stages.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: color(done ? 'success' : 'border') }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2, paddingTop: 7, paddingBottom: 18 }}>
                <Text weight={600} tone={done || current ? 'default' : 'subtle'}>{s.label}</Text>
                {current || (d.verified && i === 2) ? <Text variant="sm" tone="muted">{s.body}</Text> : null}
              </View>
            </View>
          )
        })}
      </View>

      <View style={{ gap: 10, backgroundColor: color('surface'), borderRadius: tokens.radius.lg, padding: 16 }}>
        <Eyebrow>Your vehicle</Eyebrow>
        <Text weight={600}>{d.vehicle.year} {d.vehicle.make} {d.vehicle.model} · {d.vehicle.color}</Text>
        <PlateBadge plate={d.vehicle.plate} />
        <Text variant="sm" tone="muted">Bookings you can take: {d.classes.map((c) => vehicle(c).tag).join(' · ')}</Text>
        <Text variant="sm" tone="muted">{formatUsPhone(d.phone)} · {d.city} · {d.days.join(' ')}</Text>
      </View>
      <CallButton />
    </Screen>
  )
}
