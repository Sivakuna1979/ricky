import { File, Paths } from 'expo-file-system'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import { router, useLocalSearchParams } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, ErrorText, Heading, Label, ProgressBar } from '../../../components/ui'
import { deleteFilm, getFilm, signedUrls, startRender, type Film } from '../../../lib/films'
import { colors, radius, space } from '../../../theme'

export default function FilmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [film, setFilm] = useState<Film | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'share' | 'save' | 'retry' | 'delete'>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const f = await getFilm(id)
      setFilm(f)
      if (f.status === 'ready' && f.video_path) setVideoUrl((await signedUrls([f.video_path]))[f.video_path])
    } catch {
      setError('Could not load this film.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const making = film?.status === 'queued' || film?.status === 'rendering'
  useEffect(() => {
    if (!making) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [making, load])

  const player = useVideoPlayer(videoUrl ?? null, (p) => {
    p.loop = false
  })

  /** Download once to the phone's cache; both Share and Save use the local file. */
  async function localCopy(): Promise<File> {
    if (!film?.video_path || !videoUrl) throw new Error('The film is not ready yet.')
    const safeName = (film.script?.title ?? film.subject_name).replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Life Story'
    const target = new File(Paths.cache, `${safeName}.mp4`)
    if (target.exists) return target
    return File.downloadFileAsync(videoUrl, target)
  }

  async function share() {
    setBusy('share')
    setError(null)
    try {
      const file = await localCopy()
      await Sharing.shareAsync(file.uri, { mimeType: 'video/mp4', dialogTitle: 'Share this film', UTI: 'public.mpeg-4' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share the film.')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    setBusy('save')
    setError(null)
    setMessage(null)
    try {
      // Only ask to add videos; the app never needs to read the library.
      const perm = await requestPermissionsAsync(true, Platform.OS === 'android' ? ['video'] : undefined)
      if (!perm.granted) throw new Error('Allow access to Photos in Settings to save the film.')
      const file = await localCopy()
      await Asset.create(file.uri)
      setMessage('Saved to your Photos.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the film.')
    } finally {
      setBusy(null)
    }
  }

  async function retry() {
    if (!film) return
    setBusy('retry')
    try {
      await startRender(film.id, { voice: film.voice, format: film.format })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restart the film.')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('delete')
    try {
      await deleteFilm(id)
      router.replace('/')
    } catch {
      setError('Could not delete the film.')
      setBusy(null)
    }
  }

  if (!film) {
    return <View style={styles.center}>{error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} />}</View>
  }

  const title = film.script?.title ?? film.subject_name

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.page}>
        {film.status === 'ready' && videoUrl ? (
          <>
            <VideoView player={player} style={[styles.video, { aspectRatio: film.format === 'portrait' ? 9 / 16 : 16 / 9 }]} contentFit="contain" fullscreenOptions={{ enable: true }} allowsPictureInPicture nativeControls />
            <View style={{ gap: space.xs }}>
              <Heading>{title}</Heading>
              {film.script?.subtitle ? <Body muted>{film.script.subtitle}</Body> : null}
            </View>
            <Button label="Share" onPress={share} loading={busy === 'share'} disabled={Boolean(busy)} />
            <Button label="Save to Photos" variant="ghost" onPress={save} loading={busy === 'save'} disabled={Boolean(busy)} />
            {message ? <Body style={{ color: colors.success }}>{message}</Body> : null}
            <Body muted style={{ fontSize: 14 }}>
              Playing it at a party? Use “Share” → AirPlay or Cast, or plug your phone into the TV.
            </Body>
          </>
        ) : null}

        {making ? (
          <View style={styles.making}>
            <Label>{film.status === 'queued' ? 'In the queue' : 'Making your film'}</Label>
            <Heading size={30}>{title}</Heading>
            <ProgressBar value={film.status === 'queued' ? 0.02 : film.progress} />
            <Body muted>
              {film.status === 'queued' ? 'Your film will start in a moment.' : `${Math.round(film.progress * 100)}% · recording the narration and putting the scenes together.`} We'll send you a notification when it's ready, so you can close the app.
            </Body>
          </View>
        ) : null}

        {film.status === 'failed' ? (
          <View style={styles.making}>
            <Label>Something went wrong</Label>
            <Heading size={30}>{title}</Heading>
            <Body muted>We couldn't finish this film. Trying again is free; you won't be charged twice.</Body>
            <Button label="Try again" onPress={retry} loading={busy === 'retry'} disabled={Boolean(busy)} />
          </View>
        ) : null}

        <ErrorText>{error}</ErrorText>
        {!making ? <Button label="Delete this film" variant="danger" onPress={remove} loading={busy === 'delete'} disabled={Boolean(busy)} style={{ marginTop: space.xl }} /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  page: { padding: space.xl, gap: space.lg, paddingBottom: 60 },
  video: { width: '100%', maxHeight: 560, borderRadius: radius.lg, backgroundColor: '#000', alignSelf: 'center' },
  making: { gap: space.lg, padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
})
