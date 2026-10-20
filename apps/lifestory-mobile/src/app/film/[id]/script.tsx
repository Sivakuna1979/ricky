import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, Chip, ErrorText, Field, Heading, Label, Steps } from '../../../components/ui'
import { ApiError } from '../../../lib/api'
import { getFilm, listPhotos, saveScript, signedUrls, startRender, VOICES, writeScript, type Format, type Script, type Voice } from '../../../lib/films'
import { registerForPush } from '../../../lib/notifications'
import { buy, filmProducts, paymentsEnabled, type FilmProduct } from '../../../lib/purchases'
import { colors, fonts, radius, space } from '../../../theme'

export default function ScriptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [script, setScript] = useState<Script | null>(null)
  const [dirty, setDirty] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [voice, setVoice] = useState<Voice>('warm_female')
  const [format, setFormat] = useState<Format>('landscape')
  const [product, setProduct] = useState<FilmProduct | null>(null)
  const [busy, setBusy] = useState<null | 'rewrite' | 'order'>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [film, photos] = await Promise.all([getFilm(id), listPhotos(id)])
        setScript(film.script)
        setVoice(film.voice)
        setFormat(film.format)
        const urls = await signedUrls(photos.map((p) => p.storage_path))
        setThumbs(Object.fromEntries(photos.map((p) => [p.id, urls[p.storage_path]])))
        const products = await filmProducts().catch(() => [])
        setProduct(products[0] ?? null)
      } catch {
        setError('Could not load the script.')
      }
    })()
  }, [id])

  const edit = (next: Script) => {
    setScript(next)
    setDirty(true)
  }
  const editScene = (i: number, patch: Partial<Script['scenes'][number]>) => script && edit({ ...script, scenes: script.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  async function rewrite() {
    setBusy('rewrite')
    setError(null)
    try {
      const res = await writeScript(id)
      setScript(res.script)
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rewrite the film.')
    } finally {
      setBusy(null)
    }
  }

  async function order() {
    if (!script) return
    setBusy('order')
    setError(null)
    try {
      if (dirty) {
        await saveScript(id, script)
        setDirty(false)
      }
      // Ask the server first: if an earlier payment never got used (say the connection dropped
      // right after paying), it starts the film without charging again.
      try {
        await startRender(id, { voice, format })
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 402) || !paymentsEnabled()) throw e
        if (!product) throw new Error('The film purchase is not available right now. Please try again later.')
        const paid = await buy(product)
        if (!paid) return setBusy(null)
        await startRender(id, { voice, format })
      }
      void registerForPush().catch(() => {})
      router.replace(`/film/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. You have not been charged twice. Please try again.')
      setBusy(null)
    }
  }

  if (!script) {
    return (
      <View style={styles.center}>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} />}
      </View>
    )
  }

  const words = script.scenes.reduce((n, s) => n + s.narration.trim().split(/\s+/).filter(Boolean).length, 0)
  const minutes = Math.max(1, Math.round(words / 140 + script.scenes.length * 0.05 + 0.2))

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Steps step={4} label="Review" />
          <Heading>Here’s your film</Heading>
          <Body muted>
            About {minutes} minute{minutes > 1 ? 's' : ''}, {script.scenes.length} scenes. Read it through and change any words you like. The narrator will read exactly what's here.
          </Body>

          <View style={styles.card}>
            <Label>Title card</Label>
            <Field value={script.title} onChangeText={(title) => edit({ ...script, title })} maxLength={80} style={styles.titleField} />
            <Field value={script.subtitle} onChangeText={(subtitle) => edit({ ...script, subtitle })} maxLength={80} placeholder="e.g. 1941 – 2025" />
          </View>

          {script.scenes.map((scene, i) => (
            <View key={i} style={styles.card}>
              <Label>Scene {i + 1}</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {scene.photoIds.map((pid) => (
                  <Image key={pid} source={{ uri: thumbs[pid] }} style={styles.thumb} contentFit="cover" />
                ))}
              </ScrollView>
              <Field value={scene.narration} onChangeText={(narration) => editScene(i, { narration })} multiline maxLength={800} />
              <Field value={scene.caption ?? ''} onChangeText={(caption) => editScene(i, { caption: caption || null })} placeholder="On-screen caption (optional), e.g. Madurai, 1962" maxLength={60} />
            </View>
          ))}

          <View style={styles.card}>
            <Label>Closing card</Label>
            <Field value={script.closing} onChangeText={(closing) => edit({ ...script, closing })} maxLength={120} />
          </View>

          <View style={{ gap: space.sm }}>
            <Label>Narrator</Label>
            <View style={styles.chips}>
              {VOICES.map((v) => (
                <Chip key={v.id} label={`${v.label} · ${v.hint}`} selected={voice === v.id} onPress={() => setVoice(v.id)} />
              ))}
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            <Label>Shape</Label>
            <View style={styles.chips}>
              <Chip label="Widescreen · for TV and projector" selected={format === 'landscape'} onPress={() => setFormat('landscape')} />
              <Chip label="Vertical · for phones and WhatsApp" selected={format === 'portrait'} onPress={() => setFormat('portrait')} />
            </View>
          </View>

          <ErrorText>{error}</ErrorText>

          <View style={styles.orderBox}>
            <Text style={styles.price}>{product ? product.price : paymentsEnabled() ? '' : 'Test mode: free'}</Text>
            <Body muted style={{ fontSize: 14, textAlign: 'center' }}>
              One payment, yours to keep. Full HD film with narration and music. We'll notify you when it's ready, usually within 15 minutes.
            </Body>
            <Button label={product ? `Make my film · ${product.price}` : 'Make my film'} onPress={order} loading={busy === 'order'} disabled={Boolean(busy) || words === 0} />
            <Button label="Rewrite the whole script" variant="ghost" onPress={rewrite} loading={busy === 'rewrite'} disabled={Boolean(busy)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  page: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  titleField: { fontFamily: fonts.display, fontSize: 26 },
  thumb: { width: 92, height: 92, borderRadius: radius.sm, backgroundColor: colors.bg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  orderBox: { gap: space.md, padding: space.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.goldDeep, backgroundColor: colors.goldSoft, alignItems: 'stretch' },
  price: { fontFamily: fonts.display, fontSize: 40, color: colors.gold, textAlign: 'center' },
})
