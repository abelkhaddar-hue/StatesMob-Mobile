import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { draft } from '@/data/draft'
import { formatWhen } from '@/data/trips'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { ClockPicker, DayStrip, dayKey } from '@/ui/trip'
import { CallButton } from '@/ui/sm'

const LEAD_MIN = 15

// Date et heure de prise en charge : au moins 15 minutes à l'avance, jusqu'à 2 semaines (au-delà : appeler le dispatch).
export default function When() {
  const current = draft.get().pickupAt
  const start = current && Date.parse(current) > Date.now() + LEAD_MIN * 60000 ? new Date(current) : null
  const [day, setDay] = useState(dayKey(start ?? new Date()))
  const [time, setTime] = useState<string | null>(start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : null)

  const soon = new Date(Date.now() + LEAD_MIN * 60000)
  const today = day === dayKey(new Date())
  // Aujourd'hui : rien avant maintenant + 15 min (arrondi au quart d'heure suivant).
  const earliest = today ? Math.ceil((soon.getHours() * 60 + soon.getMinutes()) / 15) * 15 : undefined
  const at = time ? new Date(`${day}T${time}:00`) : null
  const valid = !!at && at.getTime() >= soon.getTime() - 60000

  return (
    <Screen title="Pickup time" close footer={
      <Button label={valid ? `Pick up ${formatWhen(at!.toISOString())}` : 'Choose a time'} size="lg" fullWidth disabled={!valid}
        onPress={() => { draft.set({ pickupAt: at!.toISOString() }); router.back() }} />
    }>
      <View style={{ gap: 10 }}>
        <Text weight={600}>Day</Text>
        <DayStrip value={day} onChange={(k) => { setDay(k); setTime(null) }} />
      </View>
      <View style={{ gap: 10 }}>
        <Text weight={600}>Time</Text>
        {today && earliest != null && earliest >= 24 * 60 ? (
          <Text tone="muted">It's too late to book for today. Pick another day, or call dispatch for an immediate ride.</Text>
        ) : <ClockPicker key={day} label="Pickup time" value={time} earliest={earliest} onChange={setTime} />}
      </View>
      <Text variant="sm" tone="muted">Book at least 15 minutes ahead. Flying out of CVG? Add your flight number in the notes and we'll time the pickup.</Text>
      <CallButton />
    </Screen>
  )
}
