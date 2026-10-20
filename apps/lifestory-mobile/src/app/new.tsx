import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Body, Button, Chip, ErrorText, Field, Heading, Label, Steps } from '../components/ui'
import { createFilm, LANGUAGES, OCCASIONS, type Occasion } from '../lib/films'
import { colors, space } from '../theme'

export default function NewFilm() {
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [occasion, setOccasion] = useState<Occasion>('birthday')
  const [language, setLanguage] = useState('en')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setSaving(true)
    setError(null)
    try {
      const film = await createFilm({ subject_name: name.trim(), relation: relation.trim() || null, occasion, language })
      router.replace(`/film/${film.id}/photos`)
    } catch {
      setError('Could not create the film. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Steps step={1} label="Who is it about" />
        <Heading>Who is this film about?</Heading>

        <View style={styles.group}>
          <Label>Their name</Label>
          <Field value={name} onChangeText={setName} placeholder="What the family calls them, e.g. Amma" autoFocus maxLength={60} returnKeyType="next" />
        </View>

        <View style={styles.group}>
          <Label>Who are they to you? (optional)</Label>
          <Field value={relation} onChangeText={setRelation} placeholder="e.g. my grandmother" maxLength={60} />
        </View>

        <View style={styles.group}>
          <Label>The occasion</Label>
          <View style={styles.chips}>
            {OCCASIONS.map((o) => (
              <Chip key={o.id} label={o.label} selected={occasion === o.id} onPress={() => setOccasion(o.id)} />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Label>Narration language</Label>
          <View style={styles.chips}>
            {LANGUAGES.map((l) => (
              <Chip key={l.id} label={l.label} selected={language === l.id} onPress={() => setLanguage(l.id)} />
            ))}
          </View>
          <Body muted style={{ fontSize: 14 }}>
            You can answer the questions in any language.
          </Body>
        </View>

        <ErrorText>{error}</ErrorText>
        <Button label="Next: add photos" onPress={start} disabled={!name.trim()} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})
