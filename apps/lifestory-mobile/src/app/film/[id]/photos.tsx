import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, ErrorText, Field, Heading, Label, ProgressBar, Steps } from '../../../components/ui'
import { listPhotos, MAX_PHOTOS, removePhoto, setPhotoNote, signedUrls, uploadPhoto, type Photo } from '../../../lib/films'
import { colors, fonts, radius, space } from '../../../theme'

const MIN_PHOTOS = 3

export default function Photos() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uris, setUris] = useState<Record<string, string>>({}) // photo id → displayable uri
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null)
  const [editing, setEditing] = useState<Photo | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPhotos(id)
      .then(async (list) => {
        setPhotos(list)
        const urls = await signedUrls(list.map((p) => p.storage_path))
        setUris(Object.fromEntries(list.map((p) => [p.id, urls[p.storage_path]])))
      })
      .catch(() => setError('Could not load photos.'))
  }, [id])

  async function pick() {
    setError(null)
    const room = MAX_PHOTOS - photos.length
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      quality: 1,
    })
    if (result.canceled) return
    const assets = result.assets.slice(0, room)
    setUpload({ done: 0, total: assets.length })
    let position = photos.reduce((m, p) => Math.max(m, p.position + 1), 0)
    let failed = 0
    for (const asset of assets) {
      try {
        const photo = await uploadPhoto(id, asset, position++)
        setPhotos((prev) => [...prev, photo])
        setUris((prev) => ({ ...prev, [photo.id]: asset.uri }))
      } catch {
        failed++
      }
      setUpload((u) => (u ? { ...u, done: u.done + 1 } : u))
    }
    setUpload(null)
    if (failed) setError(`${failed} photo${failed > 1 ? 's' : ''} could not be uploaded. Check your connection and add ${failed > 1 ? 'them' : 'it'} again.`)
  }

  async function saveNote() {
    if (!editing) return
    await setPhotoNote(editing.id, note)
    setPhotos((prev) => prev.map((p) => (p.id === editing.id ? { ...p, note: note.trim() || null } : p)))
    setEditing(null)
  }

  async function remove() {
    if (!editing) return
    const target = editing
    setEditing(null)
    setPhotos((prev) => prev.filter((p) => p.id !== target.id))
    await removePhoto(target).catch(() => setError('Could not remove that photo.'))
  }

  const size = (width - space.xl * 2 - space.sm * 2) / 3

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Steps step={2} label="Photos" />
        <Heading>Add their photos</Heading>
        <Body muted>Choose 10–40 photos from across their life: childhood, family, work, celebrations. Tap a photo to add a note like “Wedding day, 1968”. Notes make the film more accurate.</Body>

        <View style={styles.grid}>
          {photos.map((p) => (
            <Pressable
              key={p.id}
              accessibilityLabel={p.note ? `Photo: ${p.note}` : 'Photo. Tap to add a note'}
              onPress={() => {
                setNote(p.note ?? '')
                setEditing(p)
              }}
              style={{ width: size, height: size }}
            >
              <Image source={{ uri: uris[p.id] }} style={styles.thumb} contentFit="cover" transition={150} />
              {p.note ? <View style={styles.noteDot} /> : null}
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable accessibilityRole="button" onPress={pick} disabled={Boolean(upload)} style={[styles.add, { width: size, height: size }]}>
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.addText}>Add photos</Text>
            </Pressable>
          ) : null}
        </View>

        {upload ? (
          <View style={{ gap: space.sm }}>
            <Body muted>
              Uploading {Math.min(upload.done + 1, upload.total)} of {upload.total}…
            </Body>
            <ProgressBar value={upload.done / upload.total} />
          </View>
        ) : null}
        <ErrorText>{error}</ErrorText>

        <Body muted style={{ fontSize: 14 }}>
          {photos.length} of {MAX_PHOTOS} photos{photos.length < MIN_PHOTOS ? ` · add at least ${MIN_PHOTOS}` : ''}
        </Body>
        <Button label="Next: tell their story" onPress={() => router.push(`/film/${id}/interview`)} disabled={photos.length < MIN_PHOTOS || Boolean(upload)} />
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)} />
        <View style={styles.sheet}>
          {editing ? <Image source={{ uri: uris[editing.id] }} style={styles.sheetImage} contentFit="contain" /> : null}
          <Label>What's happening here? (optional)</Label>
          <Field value={note} onChangeText={setNote} placeholder="e.g. Amma and Appa's wedding, Madurai 1968" maxLength={140} />
          <Button label="Save note" onPress={saveNote} />
          <Button label="Remove this photo" variant="danger" onPress={remove} />
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumb: { flex: 1, borderRadius: radius.sm, backgroundColor: colors.surface },
  noteDot: { position: 'absolute', right: 6, top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.bg },
  add: { borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.goldDeep, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addPlus: { fontFamily: fonts.display, fontSize: 36, color: colors.gold, lineHeight: 38 },
  addText: { fontFamily: fonts.medium, fontSize: 13, color: colors.gold },
  backdrop: { flex: 1, backgroundColor: '#000a' },
  sheet: { backgroundColor: colors.surface, padding: space.xl, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: 40 },
  sheetImage: { width: '100%', height: 220, borderRadius: radius.md },
})
