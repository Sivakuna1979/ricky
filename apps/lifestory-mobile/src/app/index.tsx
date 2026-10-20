import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, ErrorText, Heading, Label, ProgressBar } from '../components/ui'
import { listFilms, nextRoute, signedUrls, statusLabel, type Film } from '../lib/films'
import { colors, fonts, radius, space } from '../theme'

const HOW = [
  { n: '1', title: 'Add their photos', body: 'Old prints, phone pictures, anything. Up to 40.' },
  { n: '2', title: 'Share their story', body: 'Answer a few gentle questions, like talking to a friend.' },
  { n: '3', title: 'Get a narrated film', body: 'A 3–5 minute documentary with music, ready to play and share.' },
]

export default function Home() {
  const [films, setFilms] = useState<Film[] | null>(null)
  const [posters, setPosters] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await listFilms()
      setFilms(list)
      setError(null)
      const paths = list.map((f) => f.poster_path).filter((p): p is string => Boolean(p))
      if (paths.length) setPosters(await signedUrls(paths))
    } catch {
      setError('Could not load your films. Pull down to try again.')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  // While a film is being made, refresh every few seconds so the progress moves.
  const busy = films?.some((f) => f.status === 'queued' || f.status === 'rendering')
  useEffect(() => {
    if (!busy) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [busy, load])

  const empty = films !== null && films.length === 0

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={films ?? []}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}
        ListHeaderComponent={
          <View style={{ gap: space.xl, marginBottom: space.xl }}>
            <View style={{ gap: space.sm }}>
              <Label>Life Story</Label>
              <Heading size={empty ? 44 : 34}>{empty ? 'Turn a lifetime of photos into a film' : 'Your films'}</Heading>
              {empty ? <Body muted>For a birthday, an anniversary, or to remember someone you love.</Body> : null}
            </View>
            {empty ? (
              <View style={styles.howCard}>
                {HOW.map((h) => (
                  <View key={h.n} style={styles.howRow}>
                    <Text style={styles.howNum}>{h.n}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.howTitle}>{h.title}</Text>
                      <Body muted style={{ fontSize: 15, lineHeight: 21 }}>{h.body}</Body>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <Button label={empty ? 'Make a film' : 'Make a new film'} onPress={() => router.push('/new')} />
            <ErrorText>{error}</ErrorText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(nextRoute(item) as never)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
            <View style={styles.poster}>
              {item.poster_path && posters[item.poster_path] ? (
                <Image source={{ uri: posters[item.poster_path] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <LinearGradient colors={['#3a2f45', '#1e1a26']} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={['transparent', 'rgba(10,8,14,0.9)']} style={StyleSheet.absoluteFill} />
              <View style={styles.posterText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.script?.title ?? item.subject_name}
                </Text>
                <Text style={[styles.cardStatus, item.status === 'ready' && { color: colors.gold }, item.status === 'failed' && { color: colors.danger }]}>{statusLabel(item)}</Text>
                {item.status === 'rendering' || item.status === 'queued' ? <ProgressBar value={item.progress} /> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.xl, paddingBottom: 60, gap: space.lg },
  howCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.xl, gap: space.xl },
  howRow: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  howNum: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.gold, width: 18 },
  howTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  poster: { aspectRatio: 16 / 9, justifyContent: 'flex-end' },
  posterText: { padding: space.lg, gap: 6 },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  cardStatus: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
})
