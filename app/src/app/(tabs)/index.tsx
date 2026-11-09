import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ImageBackground, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { CalendarDays, Car, ChevronRight, LocateFixed, Quote as QuoteIcon, Repeat, Star } from 'lucide-react-native'
import { booking, serviceAreas } from '@/data/booking'
import { fleet, reasons, services, testimonials } from '@/data/fleet'
import { draft, useDraft, vehicleFor } from '@/data/draft'
import { geo, places, AIRPORT_ID } from '@/data/places'
import { formatWhen, isUpcoming, statusLabel, trips, type Trip } from '@/data/trips'
import { color, shadow, tokens } from '@/theme'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Touchable } from '@/ui/Pressable'
import { Chip } from '@/ui/primitives'
import { AddressField, FleetTile, PickerRow, Segmented, Stepper } from '@/ui/trip'
import { BrandPill, CallButton, Eyebrow } from '@/ui/sm'

const column = { width: '100%', maxWidth: tokens.layout['max-content'], alignSelf: 'center' } as const

// Prochain trajet, en haut du formulaire.
function NextTrip({ t }: { t: Trip }) {
  return (
    <Touchable onPress={() => router.push(`/trip/${t.id}`)} accessibilityRole="button"
      accessibilityLabel={`Next trip, ${statusLabel[t.status]}, ${formatWhen(t.pickupAt)}, to ${t.destination.name}. Open`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: color('accent'), backgroundColor: pressed ? color('surface-2') : color('accent-soft') })}>
      <View style={{ width: 10, height: 10, borderRadius: tokens.radius.pill, backgroundColor: color('accent') }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="xs" weight={600} tone="on-accent-soft">{statusLabel[t.status]} · {formatWhen(t.pickupAt)}</Text>
        <Text weight={600} numberOfLines={1}>To {t.destination.name}</Text>
      </View>
      <ChevronRight size={20} color={color('on-accent-soft')} />
    </Touchable>
  )
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Eyebrow tone="accent">{eyebrow}</Eyebrow>
        <Text variant="lg" heading>{title}</Text>
      </View>
      {children}
    </View>
  )
}

// Rangée qui défile jusqu'aux bords de l'écran.
function Carousel({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -tokens.layout.gutter }}
      contentContainerStyle={{ gap: 12, paddingHorizontal: tokens.layout.gutter }}>
      {children}
    </ScrollView>
  )
}

// Accueil : réservation rapide (le « Quick quote » du site), puis services, flotte, avis et zones desservies.
export default function Home() {
  const d = useDraft()
  const [mode, setMode] = useState<'private' | 'weekly'>('private')
  const [next, setNext] = useState<Trip>()
  const [name, setName] = useState<string>()
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!draft.get().pickup) geo.myPosition().then(geo.reverse).then((p) => { if (!draft.get().pickup) draft.set({ pickup: p }) }).catch(() => {})
  }, [])

  useFocusEffect(useCallback(() => {
    setName(booking.savedContact()?.fullName.split(' ')[0])
    let alive = true
    const check = () => trips.mine().then((all) => {
      if (alive) setNext(all.filter((t) => isUpcoming(t.status)).sort((a, b) => Date.parse(a.pickupAt) - Date.parse(b.pickupAt))[0])
    }).catch(() => {})
    check()
    const t = setInterval(check, 5000)
    return () => { alive = false; clearInterval(t) }
  }, []))

  const missing = { dropoff: !d.dropoff, when: !d.pickupAt || Date.parse(d.pickupAt) < Date.now() + 15 * 60000 }
  const quote = () => {
    if (!d.pickup || missing.dropoff || missing.when) { setTried(true); return }
    router.push('/book')
  }
  const pickService = (trip: (typeof services)[number]['trip']) => {
    draft.set({ tripType: trip, ...(trip === 'Airport Transfer' && !d.dropoff ? { dropoff: places.find((p) => p.id === AIRPORT_ID)! } : {}) })
    setMode('private')
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color('bg') }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <ImageBackground source={fleet[2].image} resizeMode="cover" style={{ paddingBottom: 72 }} imageStyle={{ opacity: 0.45 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: color('bg'), opacity: 0.55 }} />
        <SafeAreaView edges={['top']}>
          <View style={[column, { padding: tokens.layout.gutter, gap: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <BrandPill />
              <CallButton compact />
            </View>
            <View style={{ gap: 8, paddingTop: 8 }}>
              <Eyebrow tone="accent">Cincinnati & Northern Kentucky</Eyebrow>
              <Text variant="xl" heading style={{ fontSize: 32, lineHeight: 38 }}>
                {name ? `Where to, ${name}?` : 'Reliable rides across Cincinnati'}
              </Text>
              <Text tone="muted">Airport transfers, scheduled rides and business travel, 24/7 with professional drivers.</Text>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <View style={[column, { paddingHorizontal: tokens.layout.gutter, gap: 32, marginTop: -56 }]}>
        <View style={[{ gap: 12, padding: 16, borderRadius: tokens.radius.xl, backgroundColor: color('surface-2') }, shadow('sheet')]}>
          {next ? <NextTrip t={next} /> : null}
          <Segmented value={mode} onChange={setMode} options={[{ code: 'private', label: 'Private ride' }, { code: 'weekly', label: 'Weekly shared' }]} />
          {mode === 'private' ? (
            <>
              <AddressField kind="pickup" value={d.pickup?.name} placeholder="Finding your location…" onPress={() => router.push({ pathname: '/place', params: { field: 'pickup' } })} />
              <AddressField kind="dropoff" value={d.dropoff?.name} placeholder="CVG Airport, downtown, a hotel…" error={tried && missing.dropoff ? 'Add a destination.' : undefined}
                onPress={() => router.push({ pathname: '/place', params: { field: 'dropoff' } })} />
              <PickerRow icon={CalendarDays} label="Pickup date and time" value={d.pickupAt ? formatWhen(d.pickupAt) : undefined} placeholder="Choose when"
                error={tried && missing.when ? 'Choose a pickup time at least 15 minutes from now.' : undefined} onPress={() => router.push('/when')} />
              <Stepper label="Passengers" value={d.passengers} max={7} unit={['passenger', 'passengers']}
                onChange={(passengers) => draft.set({ passengers, vehicle: fleet.find((v) => v.code === d.vehicle)!.seats >= passengers ? d.vehicle : vehicleFor(passengers) })} />
              <Button label="Get my quote" size="lg" onPress={quote} />
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Repeat size={22} color={color('accent')} />
                <Text tone="muted" style={{ flex: 1 }}>Daily pickup from home, drop-off at work, and a ride back at the end of the day. Billed weekly instead of per trip.</Text>
              </View>
              <Button label="Set up my weekly ride" size="lg" onPress={() => router.push('/weekly')} />
            </View>
          )}
        </View>

        <Section eyebrow="What we offer" title="Transportation for every trip">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
            {services.map((s) => {
              const on = mode === 'private' && d.tripType === s.trip && s.title !== 'Hotel Transportation'
              return (
                <Touchable key={s.title} onPress={() => pickService(s.trip)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${s.title}. ${s.body}`}
                  style={({ pressed }) => ({ width: '48.8%', padding: 14, gap: 4, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: color(on ? 'accent' : 'border'), backgroundColor: pressed ? color('surface-2') : color('surface') })}>
                  <Text weight={600}>{s.title}</Text>
                  <Text variant="xs" tone="muted">{s.body}</Text>
                </Touchable>
              )
            })}
          </View>
        </Section>

        <Section eyebrow="The fleet" title="Three vehicles, one standard">
          <Carousel>
            {fleet.map((v) => (
              <FleetTile key={v.code} code={v.code} onPress={() => { draft.set({ vehicle: v.code, passengers: Math.min(d.passengers, v.seats) }); setMode('private') }} />
            ))}
          </Carousel>
        </Section>

        <Section eyebrow="Why StatesMob" title="What sets every trip apart">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
            {reasons.map((r, i) => (
              <View key={r} style={{ width: '50%', gap: 4, paddingRight: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: color('border') }}>
                <Text variant="xs" tone="accent" tabular>{String(i + 1).padStart(2, '0')}</Text>
                <Text weight={600}>{r}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section eyebrow="Testimonials" title="Riders across Cincinnati">
          <Carousel>
            {testimonials.map((t) => (
              <View key={t.name} accessible style={{ width: 280, padding: 16, gap: 10, borderRadius: tokens.radius.lg, backgroundColor: color('surface') }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel="5 stars">
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} color={color('star')} fill={color('star')} />)}
                  </View>
                  <QuoteIcon size={18} color={color('text-subtle')} />
                </View>
                <Text variant="sm">{t.quote}</Text>
                <View>
                  <Text variant="sm" weight={600}>{t.name}</Text>
                  <Text variant="xs" tone="muted">{t.place}</Text>
                </View>
              </View>
            ))}
          </Carousel>
        </Section>

        <Section eyebrow="Where we drive" title="Service areas">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {serviceAreas.map((a) => <Chip key={a} label={a} />)}
          </View>
        </Section>

        <Touchable onPress={() => router.push('/driver')} accessibilityRole="button" accessibilityLabel="Driving for StatesMob? Become a driver"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: color('accent'), backgroundColor: pressed ? color('surface-2') : color('surface') })}>
          <Car size={28} color={color('accent')} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight={700}>Driving for StatesMob?</Text>
            <Text variant="sm" tone="muted">Register your vehicle and start receiving ride requests.</Text>
          </View>
          <ChevronRight size={20} color={color('text-muted')} />
        </Touchable>

        <View style={{ gap: 8 }}>
          <Button label="Track a ride" variant="secondary" icon={LocateFixed} fullWidth onPress={() => router.push('/track')} />
          <CallButton />
        </View>
      </View>
    </ScrollView>
  )
}
