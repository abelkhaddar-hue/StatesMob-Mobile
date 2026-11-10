import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { ApiError, booking, formatUsPhone, isEmail, isUsPhone } from '@/data/booking'
import { weeklyEstimate, vehicle } from '@/data/fleet'
import { useDraft } from '@/data/draft'
import { formatUSD } from '@/data/places'
import { DAYS, formatClock, plans, type Day } from '@/data/trips'
import { useAction, useRoute } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Banner, Chip } from '@/ui/primitives'
import { AddressField, ClockPicker, Stepper } from '@/ui/trip'
import { haptic } from '@/ui/haptics'
import { Eyebrow } from '@/ui/sm'

// Abonnement « Weekly Shared Ride » : domicile → travail le matin, retour le soir, payé à la semaine.
export default function Weekly() {
  const d = useDraft()
  const saved = booking.savedContact()
  const [days, setDays] = useState<Day[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [morning, setMorning] = useState<string | null>('07:30')
  const [evening, setEvening] = useState<string | null>('17:30')
  const [passengers, setPassengers] = useState(1)
  const [notes, setNotes] = useState('')
  const [c, setC] = useState({ fullName: saved?.fullName ?? '', phone: saved ? formatUsPhone(saved.phone) : '', email: saved?.email ?? '' })
  const [tried, setTried] = useState(false)
  const send = useAction(plans.create)

  const r = useRoute(d.home?.point, d.work?.point)
  const estimate = useMemo(() => {
    if (!d.home || !d.work || !days.length || !r.route) return null
    try { return weeklyEstimate(d.home, d.work, days.length, passengers, r.route) } catch (e) { return { error: e instanceof ApiError ? e.message : String(e) } }
  }, [d.home, d.work, days.length, passengers, r.route])

  const errors = tried ? {
    home: d.home ? undefined : 'Add your home address.',
    work: d.work ? undefined : 'Add your work address.',
    days: days.length ? undefined : 'Pick at least one day.',
    times: morning && evening ? (evening > morning ? undefined : 'The evening pickup must be after the morning one.') : 'Pick both times.',
    fullName: c.fullName.trim() ? undefined : 'Add your full name.',
    phone: isUsPhone(c.phone) ? undefined : 'Enter a 10-digit US phone number.',
    email: isEmail(c.email) ? undefined : 'Enter a valid email address.',
  } : {}

  const submit = async () => {
    const ok = d.home && d.work && days.length && morning && evening && evening > morning && c.fullName.trim() && isUsPhone(c.phone) && isEmail(c.email)
    if (!ok) { setTried(true); haptic.warning(); return }
    const p = await send.run({ home: d.home!, work: d.work!, days, morningTime: morning!, eveningTime: evening!, passengers, notes: notes.trim(), ...c })
    if (p) { haptic.success(); router.replace(`/plan/${p.id}`) }
  }
  const toggle = (day: Day) => setDays((x) => (x.includes(day) ? x.filter((y) => y !== day) : DAYS.filter((y) => y === day || x.includes(y))))

  return (
    <Screen title="Weekly shared ride" footer={<>
      {send.error ? <Banner kind="danger" title={send.error} /> : null}
      <Button label="Request weekly ride" trailing={estimate && 'pricePerWeekCents' in estimate ? `~${formatUSD(estimate.pricePerWeekCents)}/wk` : undefined} size="lg" fullWidth loading={send.busy} onPress={submit} />
    </>}>
      <Text tone="muted">Daily pickup from home, drop-off at work, and pickup again at the end of the day. Tell us your schedule and we'll confirm your weekly rate.</Text>

      <View style={{ gap: 8 }}>
        <AddressField kind="home" value={d.home?.name} placeholder="Home address" error={errors.home} onPress={() => router.push({ pathname: '/place', params: { field: 'home' } })} />
        <AddressField kind="work" value={d.work?.name} placeholder="Work address" error={errors.work} onPress={() => router.push({ pathname: '/place', params: { field: 'work' } })} />
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>Days needed</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DAYS.map((day) => <Chip key={day} label={day} selected={days.includes(day)} onPress={() => toggle(day)} />)}
        </View>
        {errors.days ? <Text variant="sm" tone="danger">{errors.days}</Text> : null}
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{`Morning pickup${morning ? ` · ${formatClock(morning)}` : ''}`}</Eyebrow>
        <ClockPicker label="Morning pickup time" value={morning} onChange={setMorning} />
      </View>
      <View style={{ gap: 10 }}>
        <Eyebrow>{`Evening pickup, return home${evening ? ` · ${formatClock(evening)}` : ''}`}</Eyebrow>
        <ClockPicker label="Evening pickup time" value={evening} onChange={setEvening} />
        {errors.times ? <Text variant="sm" tone="danger">{errors.times}</Text> : null}
      </View>

      <Stepper label="Passengers" value={passengers} max={7} unit={['passenger', 'passengers']} onChange={setPassengers} />

      {estimate ? ('error' in estimate ? <Banner kind="warning" title={estimate.error!} /> : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('accent-soft') }}>
          <View style={{ flex: 1 }}>
            <Text weight={600} tone="on-accent-soft">Estimated weekly rate</Text>
            <Text variant="xs" tone="muted">{days.length} round trips · {vehicle(estimate.vehicle).tag}. Dispatch confirms the final rate.</Text>
          </View>
          <Text variant="xl" tabular>{formatUSD(estimate.pricePerWeekCents)}</Text>
        </View>
      )) : null}

      <View style={{ gap: 12 }}>
        <Eyebrow>Contact</Eyebrow>
        <Field label="Full name" value={c.fullName} onChangeText={(fullName) => setC({ ...c, fullName })} error={errors.fullName} autoComplete="name" />
        <Field label="Phone" value={c.phone} onChangeText={(v) => setC({ ...c, phone: formatUsPhone(v) })} error={errors.phone} placeholder="513-000-0000" keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Email" value={c.email} onChangeText={(email) => setC({ ...c, email })} error={errors.email} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      </View>
      <Field label="Additional notes" value={notes} onChangeText={setNotes} multiline maxLength={500} counter placeholder="Anything else we should know" />
    </Screen>
  )
}
