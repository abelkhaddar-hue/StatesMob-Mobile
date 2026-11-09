import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Info, KeyRound, LocateFixed, ReceiptText, RotateCcw } from 'lucide-react-native'
import { booking, formatUsPhone, serviceAreas } from '@/data/booking'
import { draft } from '@/data/draft'
import { signOut } from '@/data/supabase'
import { driver, STEPS } from '@/data/driver'
import { useAction } from '@/data/hooks'
import { color, tokens } from '@/theme'
import { TabScreen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Avatar, Banner, ListGroup, ListRow } from '@/ui/primitives'
import { Field } from '@/ui/Field'
import { haptic } from '@/ui/haptics'
import { CallButton, Eyebrow } from '@/ui/sm'

const driveDetail = () => {
  const a = driver.saved()
  if (!a) return 'Register your vehicle and receive ride requests'
  if (!a.submittedAt) return `Application saved · step ${a.step + 1} of ${STEPS.length}`
  return 'Open your driver dashboard'
}

// Compte : coordonnées du passager, suivi par téléphone, espace chauffeur, dispatch, remise à zéro.
export default function Account() {
  const [f, setF] = useState({ fullName: '', phone: '', email: '' })
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [drive, setDrive] = useState(driveDetail())
  const save = useAction(booking.saveContact)
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); setSaved(false); save.setError(undefined) }
  const submitted = !!driver.saved()?.submittedAt

  useFocusEffect(useCallback(() => {
    const c = booking.savedContact()
    setF(c ? { fullName: c.fullName, phone: formatUsPhone(c.phone), email: c.email } : { fullName: '', phone: '', email: '' })
    setSaved(false); setConfirmReset(false); setDrive(driveDetail())
  }, []))

  const submit = async () => {
    const c = await save.run(f)
    if (c) { haptic.success(); setSaved(true) }
  }

  // Nouveau compte anonyme : les anciens trajets restent en base mais ne sont plus liés à cet appareil.
  const reset = () => {
    booking.clearContact(); driver.clear(); signOut('passenger'); draft.set({ dropoff: null, pickupAt: null, home: null, work: null, notes: '' })
    setF({ fullName: '', phone: '', email: '' }); setConfirmReset(false); setDrive(driveDetail()); haptic.success()
  }

  return (
    <TabScreen title="Account">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={f.fullName || 'Guest'} size="lg" />
        <View style={{ flex: 1 }}>
          <Text variant="lg" heading numberOfLines={1}>{f.fullName || 'Guest'}</Text>
          <Text variant="sm" tone="muted">{f.phone || 'Add your details to book faster'}</Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Eyebrow>Your details</Eyebrow>
        <Field label="Full name" value={f.fullName} onChangeText={(fullName) => set({ fullName })} placeholder="Jane Carter" autoComplete="name" textContentType="name" />
        <Field label="Phone" value={f.phone} onChangeText={(v) => set({ phone: formatUsPhone(v) })} placeholder="513-000-0000" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Field label="Email" value={f.email} onChangeText={(email) => set({ email })} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        {save.error ? <Banner kind="danger" title={save.error} /> : null}
        {saved ? <Banner kind="success" title="Details saved" body="We fill them in for your next booking." /> : null}
        <Button label="Save details" variant="secondary" fullWidth loading={save.busy} onPress={submit} />
      </View>

      <ListGroup>
        <ListRow icon={LocateFixed} label="Track a ride" detail="Find a booking with its phone number" onPress={() => router.push('/track')} />
        <ListRow icon={KeyRound} label={submitted ? 'Driver dashboard' : 'Become a driver'} detail={drive} onPress={() => router.push(submitted ? '/drive' : '/driver')} />
        {submitted ? <ListRow icon={ReceiptText} label="Driver earnings" detail="Rides you drove and what you earned" onPress={() => router.push('/drive/history')} /> : null}
      </ListGroup>

      <CallButton />

      <View style={{ gap: 8, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Info size={16} color={color('text-muted')} />
          <Text weight={600}>Where we drive</Text>
        </View>
        <Text variant="sm" tone="muted">{serviceAreas.join(' · ')}</Text>
      </View>

      <ListGroup>
        <ListRow icon={RotateCcw} label="Reset demo data" detail="Forget my details, trips on this device and driver application" danger onPress={() => setConfirmReset(true)} />
      </ListGroup>
      {confirmReset ? (
        <View style={{ gap: 8 }}>
          <Banner kind="warning" title="Reset everything on this device?" body="You start again as a new passenger. This can't be undone." />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Reset" variant="danger" onPress={reset} />
            <Button label="Keep my data" variant="secondary" onPress={() => setConfirmReset(false)} />
          </View>
        </View>
      ) : null}
      <Text variant="xs" tone="muted" center>StatesMob 1.0 · Test server — bookings are real requests seen by registered drivers.</Text>
    </TabScreen>
  )
}
