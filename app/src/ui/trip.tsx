// Composants de réservation : adresses, flotte, passagers, date et heure, paiement, suivi.
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Image, ScrollView, View } from 'react-native'
import { Banknote, Briefcase, CreditCard, Minus, Phone, Plus, Star, Users, type LucideIcon } from 'lucide-react-native'
import { fleet, payLabel, type Payment, type VehicleCode } from '@/data/fleet'
import type { PlaceField } from '@/data/draft'
import { color, shadow, tokens } from '@/theme'
import { Text } from './Text'
import { Touchable } from './Pressable'
import { IconButton } from './Button'
import { Avatar, PlateBadge, RatingBadge } from './primitives'
import { haptic } from './haptics'

// ───────── adresses ─────────

const fieldLabel: Record<PlaceField, string> = { pickup: 'Pickup', dropoff: 'Destination', home: 'Home', work: 'Work' }

export function AddressField({ kind, value, placeholder, error, onPress }: { kind: PlaceField; value?: string; placeholder: string; error?: string; onPress?: () => void }) {
  const label = fieldLabel[kind]
  const start = kind === 'pickup' || kind === 'home'
  return (
    <View style={{ gap: 4 }}>
      <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'not set'}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: tokens.radius.md,
          borderWidth: error ? 2 : 0, borderColor: color('danger'), backgroundColor: pressed ? color('surface-pressed') : color('surface'),
        })}>
        <View style={{ width: 12, height: 12, borderRadius: start ? 6 : 2, backgroundColor: color(start ? 'marker-pickup' : 'marker-dropoff') }} />
        <View style={{ flex: 1 }}>
          <Text variant="xs" tone="subtle">{label}</Text>
          <Text numberOfLines={1} weight={value ? 500 : 400} tone={value ? 'default' : 'subtle'}>{value ?? placeholder}</Text>
        </View>
      </Touchable>
      {error ? <Text variant="sm" tone="danger">{error}</Text> : null}
    </View>
  )
}

// Ligne du formulaire qui ouvre un autre écran (date et heure).
export function PickerRow({ icon: Icon, label, value, placeholder, error, onPress }: { icon: LucideIcon; label: string; value?: string; placeholder: string; error?: string; onPress: () => void }) {
  return (
    <View style={{ gap: 4 }}>
      <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'not set'}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: tokens.radius.md,
          borderWidth: error ? 2 : 0, borderColor: color('danger'), backgroundColor: pressed ? color('surface-pressed') : color('surface'),
        })}>
        <Icon size={18} color={color('text-muted')} />
        <View style={{ flex: 1 }}>
          <Text variant="xs" tone="subtle">{label}</Text>
          <Text numberOfLines={1} weight={value ? 500 : 400} tone={value ? 'default' : 'subtle'}>{value ?? placeholder}</Text>
        </View>
      </Touchable>
      {error ? <Text variant="sm" tone="danger">{error}</Text> : null}
    </View>
  )
}

export function RouteSummary({ from, to, meta }: { from: string; to: string; meta?: string }) {
  return (
    <View accessible accessibilityLabel={`From ${from} to ${to}${meta ? `, ${meta}` : ''}`} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingVertical: 5 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('marker-pickup') }} />
        <View style={{ width: 2, flex: 1, backgroundColor: color('border'), marginVertical: 3 }} />
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color('marker-dropoff') }} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text variant="sm" numberOfLines={1}>{from}</Text>
        <Text variant="sm" numberOfLines={1}>{to}</Text>
      </View>
      {meta ? <Text variant="xs" tone="subtle">{meta}</Text> : null}
    </View>
  )
}

// ───────── flotte ─────────

export function VehicleCard({ code, price, fixed, selected, disabled, note, onPress }: {
  code: VehicleCode; price?: string; fixed?: boolean; selected?: boolean; disabled?: boolean; note?: string; onPress?: () => void
}) {
  const v = fleet.find((x) => x.code === code)!
  return (
    <Touchable onPress={disabled ? undefined : onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: !!selected, disabled: !!disabled }}
      accessibilityLabel={`${v.tag}, ${v.name}, up to ${v.seats} passengers and ${v.bags} bags${price ? `, ${price}` : ''}${note ? `, ${note}` : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: tokens.radius.lg, borderWidth: 2,
        borderColor: selected ? color('accent') : 'transparent', opacity: disabled ? 0.5 : 1,
        backgroundColor: selected ? color('accent-soft') : pressed ? color('surface-2') : color('surface'),
      })}>
      <Image source={v.image} style={{ width: 96, height: 64, borderRadius: tokens.radius.md }} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight={700}>{v.tag}</Text>
        <Text variant="xs" tone="muted" numberOfLines={1}>{v.name}</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Users size={12} color={color('text-muted')} /><Text variant="xs" tone="muted">{v.seats}</Text></View>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Briefcase size={12} color={color('text-muted')} /><Text variant="xs" tone="muted">{v.bags}</Text></View>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {price ? <Text variant="lg" weight={700} tabular>{price}</Text> : null}
        {note ? <Text variant="xs" tone="subtle">{note}</Text> : fixed ? <Text variant="xs" tone="accent">Fixed rate</Text> : null}
      </View>
    </Touchable>
  )
}

// Carte de la flotte (accueil) : photo, étiquette, capacité.
export function FleetTile({ code, onPress }: { code: VehicleCode; onPress: () => void }) {
  const v = fleet.find((x) => x.code === code)!
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${v.tag}: ${v.name}, ${v.seats} passengers, ${v.bags} bags. Book this vehicle`}
      style={({ pressed }) => ({ width: 232, borderRadius: tokens.radius.lg, overflow: 'hidden', backgroundColor: pressed ? color('surface-2') : color('surface') })}>
      <View>
        <Image source={v.image} style={{ width: 232, height: 132 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        <View style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.pill, backgroundColor: color('bg'), borderWidth: 1, borderColor: color('accent') }}>
          <Text variant="xs" weight={600} tone="on-accent-soft">{v.tag}</Text>
        </View>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <Text weight={600} numberOfLines={1}>{v.name}</Text>
        <Text variant="xs" tone="muted" numberOfLines={2}>{v.desc}</Text>
        <Text variant="xs" tone="accent">{v.seats} passengers · {v.bags} bags</Text>
      </View>
    </Touchable>
  )
}

// ───────── passagers ─────────

export function Stepper({ label, value, min = 1, max, onChange, unit }: { label: string; value: number; min?: number; max: number; onChange: (n: number) => void; unit: [string, string] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingRight: 8, borderRadius: tokens.radius.md, backgroundColor: color('surface') }}>
      <Users size={18} color={color('text-muted')} />
      <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`} accessibilityLiveRegion="polite">
        <Text variant="xs" tone="subtle">{label}</Text>
        <Text weight={500}>{value} {value === 1 ? unit[0] : unit[1]}</Text>
      </View>
      <IconButton icon={Minus} size={40} variant="ghost" label={`Fewer ${unit[1]}`} disabled={value <= min} onPress={() => { haptic.select(); onChange(value - 1) }} />
      <IconButton icon={Plus} size={40} variant="ghost" label={`More ${unit[1]}`} disabled={value >= max} onPress={() => { haptic.select(); onChange(value + 1) }} />
    </View>
  )
}

// ───────── date et heure ─────────

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function DayStrip({ value, days = 14, onChange }: { value: string; days?: number; onChange: (key: string) => void }) {
  const today = new Date()
  const list = Array.from({ length: days }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i))
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
      {list.map((d, i) => {
        const k = dayKey(d)
        const on = k === value
        const top = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' })
        return (
          <Touchable key={k} onPress={() => { haptic.select(); onChange(k) }} accessibilityRole="radio" accessibilityState={{ checked: on }}
            accessibilityLabel={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            style={({ pressed }) => ({
              width: 60, paddingVertical: 10, alignItems: 'center', gap: 2, borderRadius: tokens.radius.pill, borderWidth: 1,
              borderColor: on ? color('accent') : color('border'), backgroundColor: on ? color('accent') : pressed ? color('surface-2') : color('surface'),
            })}>
            <Text variant="xs" style={{ color: color(on ? 'on-accent' : 'text-muted') }}>{top}</Text>
            <Text variant="lg" weight={700} style={{ color: color(on ? 'on-accent' : 'text') }}>{d.getDate()}</Text>
            <Text variant="xs" style={{ color: color(on ? 'on-accent' : 'text-subtle') }}>{d.toLocaleDateString('en-US', { month: 'short' })}</Text>
          </Touchable>
        )
      })}
    </ScrollView>
  )
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`

// Heure en « HH:MM » : une rangée d'heures, puis les quarts d'heure. `earliest` grise ce qui est trop tôt.
export function ClockPicker({ value, onChange, earliest, label }: { value: string | null; onChange: (hhmm: string) => void; earliest?: number; label: string }) {
  const [h, m] = value ? value.split(':').map(Number) : [null, null]
  const scroll = useRef<ScrollView>(null)
  const first = earliest != null ? Math.floor(earliest / 60) : 0
  useEffect(() => {
    const target = h ?? (earliest != null ? first : 6) // un autre jour : on commence vers 6 h du matin
    setTimeout(() => scroll.current?.scrollTo({ x: Math.max(0, target - 1) * 76, animated: false }), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const ok = (hh: number, mm: number) => earliest == null || hh * 60 + mm >= earliest
  const pick = (hh: number, mm: number) => { haptic.select(); onChange(`${pad(hh)}:${pad(mm)}`) }
  return (
    <View style={{ gap: 10 }} accessibilityLabel={label}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: 24 }, (_, hh) => {
          const can = ok(hh, 45)
          const on = h === hh
          return (
            <Touchable key={hh} disabled={!can} onPress={() => pick(hh, m != null && ok(hh, m) ? m : [0, 15, 30, 45].find((x) => ok(hh, x))!)}
              accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !can }} accessibilityLabel={hourLabel(hh)}
              style={({ pressed }) => ({
                width: 68, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.pill, borderWidth: 1, opacity: can ? 1 : 0.35,
                borderColor: on ? color('accent') : color('border'), backgroundColor: on ? color('accent') : pressed ? color('surface-2') : color('surface'),
              })}>
              <Text variant="sm" weight={on ? 700 : 500} style={{ color: color(on ? 'on-accent' : 'text') }}>{hourLabel(hh)}</Text>
            </Touchable>
          )
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 15, 30, 45].map((mm) => {
          const can = h != null && ok(h, mm)
          const on = m === mm && h != null
          return (
            <Touchable key={mm} disabled={!can} onPress={() => pick(h!, mm)} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !can }}
              accessibilityLabel={`${mm} minutes`}
              style={({ pressed }) => ({
                flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.pill, borderWidth: 1, opacity: can ? 1 : 0.35,
                borderColor: on ? color('accent') : color('border'), backgroundColor: on ? color('accent-soft') : pressed ? color('surface-2') : color('surface'),
              })}>
              <Text variant="sm" weight={on ? 700 : 500} tone={on ? 'on-accent-soft' : 'default'}>:{pad(mm)}</Text>
            </Touchable>
          )
        })}
      </View>
    </View>
  )
}

// ───────── paiement ─────────

const payIcon: Record<Payment, LucideIcon> = { cash: Banknote, card: CreditCard }

export function PaymentPicker({ value, onChange }: { value: Payment; onChange: (m: Payment) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
      {(['cash', 'card'] as const).map((code) => {
        const on = value === code
        const Icon = payIcon[code]
        return (
          <Touchable key={code} onPress={() => { haptic.select(); onChange(code) }} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={payLabel[code]}
            style={({ pressed }) => ({
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: tokens.radius.pill,
              borderWidth: 1, borderColor: on ? color('accent') : color('border'), backgroundColor: on ? color('accent-soft') : pressed ? color('surface-2') : color('surface'),
            })}>
            <Icon size={tokens.size.icon} color={on ? color('on-accent-soft') : color('text')} />
            <Text variant="sm" weight={on ? 600 : 400} tone={on ? 'on-accent-soft' : 'default'}>{payLabel[code]}</Text>
          </Touchable>
        )
      })}
    </View>
  )
}

// ───────── suivi ─────────

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { code: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: tokens.radius.pill, backgroundColor: color('surface') }}>
      {options.map((o) => {
        const on = o.code === value
        return (
          <Touchable key={o.code} onPress={() => { haptic.select(); onChange(o.code) }} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.pill, backgroundColor: on ? color('accent') : 'transparent' }}>
            <Text variant="sm" weight={on ? 700 : 500} style={{ color: color(on ? 'on-accent' : 'text') }}>{o.label}</Text>
          </Touchable>
        )
      })}
    </View>
  )
}

// Étapes de la réservation, du dépôt de la demande à l'arrivée.
export function StatusSteps({ steps, at }: { steps: { label: string; body?: string }[]; at: number }) {
  return (
    <View>
      {steps.map((s, i) => {
        const done = i < at, current = i === at
        return (
          <View key={s.label} accessible accessibilityLabel={`${s.label}, ${done ? 'done' : current ? 'now' : 'next'}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={{ width: current ? 20 : 12, height: current ? 20 : 12, marginTop: current ? 0 : 4, borderRadius: 10, borderWidth: current ? 5 : 0,
                borderColor: color('accent-soft'), backgroundColor: color(done || current ? 'accent' : 'surface-2') }} />
              {i < steps.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: color(done ? 'accent' : 'border') }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14, gap: 2 }}>
              <Text weight={current ? 700 : 500} tone={done || current ? 'default' : 'subtle'}>{s.label}</Text>
              {current && s.body ? <Text variant="sm" tone="muted">{s.body}</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export function DriverCard({ name, rating, count, vehicle, plate, onCall }: { name: string; rating: number; count: number; vehicle: string; plate: string; onCall?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <Avatar name={name} size="lg" />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text variant="lg">{name}</Text>
          <RatingBadge rating={rating} count={count} />
        </View>
        <Text variant="sm" tone="muted">{vehicle}</Text>
        <PlateBadge plate={plate} />
      </View>
      {onCall ? <IconButton icon={Phone} label={`Call ${name}`} onPress={onCall} /> : null}
    </View>
  )
}

export function SearchingPulse({ label }: { label: string }) {
  const p = useRef(new Animated.Value(0)).current
  const [reduce, setReduce] = useState(false)
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce) }, [])
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(Animated.timing(p, { toValue: 1, duration: tokens.motion.slow * 5, easing: Easing.out(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [p, reduce])
  return (
    <View style={{ alignItems: 'center', gap: 12 }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1].map((i) => (
          <Animated.View key={i} style={{
            position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: color('accent'),
            opacity: reduce ? 0.12 : p.interpolate({ inputRange: [0, 1], outputRange: [0.25 - i * 0.1, 0] }),
            transform: [{ scale: reduce ? 0.8 : p.interpolate({ inputRange: [0, 1], outputRange: [0.3 + i * 0.2, 1] }) }],
          }} />
        ))}
        <View style={[{ width: 18, height: 18, borderRadius: 9, backgroundColor: color('marker-pickup'), borderWidth: 3, borderColor: color('bg') }, shadow('card')]} />
      </View>
      <Text tone="muted" center>{label}</Text>
    </View>
  )
}

export function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Rate your ride"
      accessibilityValue={{ min: 0, max: 5, now: value, text: value ? `${value} out of 5 stars` : 'Not rated yet' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(1, Math.min(5, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
      style={{ flexDirection: 'row', gap: 4, alignSelf: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Touchable key={n} onPress={() => { haptic.select(); onChange(n) }} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} style={{ padding: 4, borderRadius: tokens.radius.pill }}>
          <Star size={36} color={n <= value ? color('star') : color('border-input')} fill={n <= value ? color('star') : 'transparent'} />
        </Touchable>
      ))}
    </View>
  )
}

