import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { booking, formatUsPhone, isEmail, isUsPhone } from '@/data/booking'
import { quote, vehicle } from '@/data/fleet'
import { draft, useDraft } from '@/data/draft'
import { formatUSD } from '@/data/places'
import { formatWhen, trips } from '@/data/trips'
import { useAction, useRoute } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Banner, Divider } from '@/ui/primitives'
import { PaymentPicker, RouteSummary } from '@/ui/trip'
import { haptic } from '@/ui/haptics'
import { Eyebrow } from '@/ui/sm'
import { DISPATCH_PHONE } from '@/data/booking'

// Coordonnées, paiement, notes, puis envoi de la demande au dispatch.
export default function Details() {
  const d = useDraft()
  const saved = booking.savedContact()
  const [c, setC] = useState({ fullName: saved?.fullName ?? '', phone: saved ? formatUsPhone(saved.phone) : '', email: saved?.email ?? '' })
  const [tried, setTried] = useState(false)
  const send = useAction(trips.book)
  const r = useRoute(d.pickup?.point, d.dropoff?.point)
  const q = d.pickup && d.dropoff && r.route ? quote(d.pickup, d.dropoff, d.vehicle, r.route) : null
  const v = vehicle(d.vehicle)
  const errors = tried ? {
    fullName: c.fullName.trim() ? undefined : 'Add your full name.',
    phone: isUsPhone(c.phone) ? undefined : 'Enter a 10-digit US phone number.',
    email: isEmail(c.email) ? undefined : 'Enter a valid email address.',
  } : {}

  const submit = async () => {
    if (!c.fullName.trim() || !isUsPhone(c.phone) || !isEmail(c.email)) { setTried(true); haptic.warning(); return }
    if (!d.pickup || !d.dropoff || !d.pickupAt) return
    const t = await send.run({ ...c, pickup: d.pickup, destination: d.dropoff, pickupAt: d.pickupAt, passengers: d.passengers, tripType: d.tripType, vehicle: d.vehicle, payment: d.payment, notes: d.notes.trim() })
    if (t) { haptic.success(); draft.reset(); router.dismissAll(); router.push(`/trip/${t.id}`) }
  }

  return (
    <Screen title="Your details" footer={<>
      {send.error ? <Banner kind="danger" title={send.error} body={`For urgent trips, call ${DISPATCH_PHONE}.`} /> : null}
      <Button label="Request my ride" trailing={q ? formatUSD(q.priceCents) : undefined} size="lg" fullWidth loading={send.busy} onPress={submit} />
      <Text variant="xs" tone="subtle" center>Your request goes to our dispatch team. We confirm by text with your driver's name, car and arrival time.</Text>
    </>}>
      <View style={{ gap: 12, padding: 14, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <RouteSummary from={d.pickup?.name ?? '—'} to={d.dropoff?.name ?? '—'} />
        <Divider />
        <Row label="When" value={d.pickupAt ? formatWhen(d.pickupAt) : '—'} />
        <Row label="Vehicle" value={`${v.tag} · ${v.name}`} />
        <Row label="Trip" value={`${d.tripType} · ${d.passengers} ${d.passengers === 1 ? 'passenger' : 'passengers'}`} />
        {q ? <Row label={q.fixedRate ? 'Fixed airport rate' : 'Estimated fare'} value={formatUSD(q.priceCents)} strong /> : null}
      </View>

      <View style={{ gap: 12 }}>
        <Eyebrow>Contact</Eyebrow>
        <Field label="Full name" value={c.fullName} onChangeText={(fullName) => setC({ ...c, fullName })} error={errors.fullName} placeholder="Jane Carter" autoComplete="name" textContentType="name" />
        <Field label="Phone number" value={c.phone} onChangeText={(v) => setC({ ...c, phone: formatUsPhone(v) })} error={errors.phone} placeholder="513-000-0000"
          hint="Your driver texts this number. You can also track your ride with it." keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Field label="Email address" value={c.email} onChangeText={(email) => setC({ ...c, email })} error={errors.email} placeholder="you@email.com"
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      </View>

      <View style={{ gap: 12 }}>
        <Eyebrow>Payment</Eyebrow>
        <PaymentPicker value={d.payment} onChange={(payment) => draft.set({ payment })} />
        <Text variant="sm" tone="muted">{d.payment === 'cash' ? 'Pay your driver in cash at the end of the trip.' : 'Pay by card at the end of the trip. Your driver has a card reader.'}</Text>
      </View>

      <Field label="Additional notes" value={d.notes} onChangeText={(notes) => draft.set({ notes })} multiline maxLength={500} counter
        placeholder="Flight number, extra luggage, child seat…" />
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
