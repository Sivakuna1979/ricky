import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { ImagePickerAsset } from 'expo-image-picker'
import { api } from './api'
import { BUCKET, ensureSession, supabase } from './supabase'

export type Occasion = 'birthday' | 'anniversary' | 'memorial' | 'wedding' | 'retirement' | 'celebration'
export type FilmStatus = 'draft' | 'scripted' | 'queued' | 'rendering' | 'ready' | 'failed'
export type Voice = 'warm_female' | 'warm_male' | 'storyteller'
export type Format = 'landscape' | 'portrait'

export interface Scene {
  photoIds: string[]
  narration: string
  caption: string | null
}

export interface Script {
  title: string
  subtitle: string
  scenes: Scene[]
  closing: string
  musicMood: 'gentle' | 'uplifting' | 'nostalgic'
}

export interface Film {
  id: string
  subject_name: string
  relation: string | null
  occasion: Occasion
  language: string
  voice: Voice
  format: Format
  status: FilmStatus
  interview: { role: 'assistant' | 'user'; content: string }[]
  script: Script | null
  progress: number
  video_path: string | null
  poster_path: string | null
  duration_seconds: number | null
  error: string | null
  created_at: string
}

export interface Photo {
  id: string
  storage_path: string
  position: number
  note: string | null
}

export const OCCASIONS: { id: Occasion; label: string }[] = [
  { id: 'birthday', label: 'Birthday' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'memorial', label: 'In memory' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'celebration', label: 'Just because' },
]

export const LANGUAGES: { id: string; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'ml', label: 'മലയാളം' },
  { id: 'te', label: 'తెలుగు' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
]

export const VOICES: { id: Voice; label: string; hint: string }[] = [
  { id: 'warm_female', label: 'Warm & gentle', hint: 'Female voice' },
  { id: 'warm_male', label: 'Warm & calm', hint: 'Male voice' },
  { id: 'storyteller', label: 'Storyteller', hint: 'British male voice' },
]

export const MAX_PHOTOS = 40

export async function listFilms(): Promise<Film[]> {
  await ensureSession()
  const { data, error } = await supabase.from('ls_films').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Film[]
}

export async function getFilm(id: string): Promise<Film> {
  const { data, error } = await supabase.from('ls_films').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as Film
}

export async function createFilm(input: { subject_name: string; relation: string | null; occasion: Occasion; language: string }): Promise<Film> {
  await ensureSession()
  const { data, error } = await supabase.from('ls_films').insert(input).select('*').single()
  if (error) throw new Error(error.message)
  return data as Film
}

export async function deleteFilm(id: string) {
  const { error } = await supabase.from('ls_films').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listPhotos(filmId: string): Promise<Photo[]> {
  const { data, error } = await supabase.from('ls_photos').select('id, storage_path, position, note').eq('film_id', filmId).order('position')
  if (error) throw new Error(error.message)
  return data as Photo[]
}

/** Shrink to at most 2000px, bake in the phone's rotation, upload, and record it. */
export async function uploadPhoto(filmId: string, asset: ImagePickerAsset, position: number): Promise<Photo> {
  const userId = await ensureSession()
  const longest = Math.max(asset.width || 0, asset.height || 0)
  const context = ImageManipulator.manipulate(asset.uri)
  if (longest > 2000) context.resize(asset.width >= asset.height ? { width: 2000 } : { height: 2000 })
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })
  const bytes = await new File(saved.uri).arrayBuffer()

  const path = `${userId}/${filmId}/photos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' })
  if (upErr) throw new Error(upErr.message)
  const { data, error } = await supabase.from('ls_photos').insert({ film_id: filmId, storage_path: path, position }).select('id, storage_path, position, note').single()
  if (error) throw new Error(error.message)
  return data as Photo
}

export async function removePhoto(photo: Photo) {
  await supabase.from('ls_photos').delete().eq('id', photo.id)
  await supabase.storage.from(BUCKET).remove([photo.storage_path])
}

export async function setPhotoNote(photoId: string, note: string) {
  await supabase.from('ls_photos').update({ note: note.trim() || null }).eq('id', photoId)
}

/** Signed URLs for private files, cached briefly so lists don't re-sign on every render. */
const signed = new Map<string, { url: string; until: number }>()
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const missing = paths.filter((p) => !(signed.get(p)?.until! > now))
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 3600)
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, { url: d.signedUrl, until: now + 50 * 60_000 })
  }
  return Object.fromEntries(paths.map((p) => [p, signed.get(p)?.url ?? '']))
}

// ---- API calls (the server holds the Claude key and does the heavy work)

export interface InterviewStep {
  question: string
  done: boolean
  answered: number
  max: number
}

export const interviewNext = (filmId: string, answer?: string) => api<InterviewStep>(`/api/films/${filmId}/interview`, { body: answer ? { answer } : {} })
export const writeScript = (filmId: string) => api<{ script: Script }>(`/api/films/${filmId}/script`)
export const saveScript = (filmId: string, script: Script) => api<{ script: Script }>(`/api/films/${filmId}/script`, { method: 'PUT', body: script })
export const startRender = (filmId: string, options: { voice: Voice; format: Format }) => api<{ status: FilmStatus }>(`/api/films/${filmId}/render`, { body: options })

export function statusLabel(film: Film): string {
  switch (film.status) {
    case 'draft':
      return film.interview.length ? 'Interview in progress' : 'Adding photos'
    case 'scripted':
      return 'Script ready to review'
    case 'queued':
      return 'Waiting to be made'
    case 'rendering':
      return `Making your film · ${Math.round(film.progress * 100)}%`
    case 'ready':
      return 'Ready to watch'
    case 'failed':
      return 'Needs attention'
  }
}

/** Where to go when a film is tapped, based on how far along it is. */
export function nextRoute(film: Film): string {
  if (film.status === 'draft') return film.interview.length ? `/film/${film.id}/interview` : `/film/${film.id}/photos`
  if (film.status === 'scripted') return `/film/${film.id}/script`
  return `/film/${film.id}`
}
