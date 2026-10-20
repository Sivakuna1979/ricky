import { router, useLocalSearchParams } from 'expo-router'
import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, ErrorText, Field, Heading, Steps } from '../../../components/ui'
import { getFilm, interviewNext, writeScript } from '../../../lib/films'
import { colors, fonts, radius, space } from '../../../theme'

type Turn = { role: 'assistant' | 'user'; content: string }

const MIN_ANSWERS = 4
const WRITING_LINES = ['Looking through the photos…', 'Putting their life in order…', 'Finding the right words…', 'Choosing the music…', 'Almost there…']

export default function Interview() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [turns, setTurns] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(true)
  const [done, setDone] = useState(false)
  const [writing, setWriting] = useState(false)
  const [line, setLine] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)

  const answered = turns.filter((t) => t.role === 'user').length

  useEffect(() => {
    ;(async () => {
      try {
        const film = await getFilm(id)
        setTurns(film.interview)
        if (film.interview.at(-1)?.role !== 'assistant') {
          const step = await interviewNext(id)
          setTurns((t) => [...t, { role: 'assistant', content: step.question }])
          setDone(step.done)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start the interview.')
      } finally {
        setBusy(false)
      }
    })()
  }, [id])

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50)
  }, [turns, busy])

  useEffect(() => {
    if (!writing) return
    const t = setInterval(() => setLine((l) => Math.min(l + 1, WRITING_LINES.length - 1)), 9000)
    return () => clearInterval(t)
  }, [writing])

  async function send(text: string) {
    const value = text.trim()
    if (!value || busy) return
    setAnswer('')
    setError(null)
    setTurns((t) => [...t, { role: 'user', content: value }])
    setBusy(true)
    try {
      const step = await interviewNext(id, value)
      setTurns((t) => [...t, { role: 'assistant', content: step.question }])
      setDone(step.done)
    } catch (e) {
      setTurns((t) => t.slice(0, -1))
      setAnswer(value)
      setError(e instanceof Error ? e.message : 'Could not send. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function write() {
    setWriting(true)
    setLine(0)
    setError(null)
    try {
      await writeScript(id)
      router.replace(`/film/${id}/script`)
    } catch (e) {
      setWriting(false)
      setError(e instanceof Error ? e.message : 'Could not write the film. Try again.')
    }
  }

  if (writing) {
    return (
      <View style={styles.writing}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Heading size={30}>Writing your film</Heading>
        <Body muted style={{ textAlign: 'center' }}>{WRITING_LINES[line]}</Body>
        <Body muted style={{ textAlign: 'center', fontSize: 14 }}>This usually takes about a minute.</Body>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Steps step={3} label="Their story" />
          <Heading size={30}>Tell us about them</Heading>
          <Body muted>Answer in your own words, in any language. Short answers are fine. Names, places and little details make the film special.</Body>

          {turns.map((t, i) => (
            <View key={i} style={[styles.bubble, t.role === 'user' ? styles.mine : styles.theirs]}>
              <Text style={[styles.bubbleText, t.role === 'assistant' && styles.question]}>{t.content}</Text>
            </View>
          ))}
          {busy ? <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start', marginLeft: space.lg }} /> : null}
          <ErrorText>{error}</ErrorText>

          {done || answered >= MIN_ANSWERS ? (
            <View style={styles.ready}>
              <Body>{done ? 'That’s everything we need.' : 'You can keep going, or write the film now.'}</Body>
              <Button label="Write my film" onPress={write} disabled={busy} />
            </View>
          ) : null}
        </ScrollView>

        {!done ? (
          <View style={styles.composer}>
            <Field value={answer} onChangeText={setAnswer} placeholder="Type your answer…" multiline style={{ flex: 1, minHeight: 52, maxHeight: 160 }} editable={!busy} />
            <View style={{ gap: space.sm }}>
              <Pressable accessibilityRole="button" onPress={() => send(answer)} disabled={!answer.trim() || busy} style={[styles.send, (!answer.trim() || busy) && { opacity: 0.4 }]}>
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => send('(I would rather skip this one.)')} disabled={busy}>
                <Text style={styles.skip}>Skip</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.lg, paddingBottom: 40 },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.lg },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldDeep, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text },
  question: { fontFamily: fonts.displayItalic, fontSize: 21, lineHeight: 27 },
  ready: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep },
  composer: { flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, alignItems: 'flex-end', backgroundColor: colors.bg },
  send: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 14 },
  sendText: { fontFamily: fonts.semibold, color: colors.bg, fontSize: 15 },
  skip: { fontFamily: fonts.medium, color: colors.muted, fontSize: 14, textAlign: 'center' },
  writing: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl },
})
