import { google, youtube_v3 } from 'googleapis'
import fs from 'fs'

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>

function yt(auth: OAuth2Client) {
  return google.youtube({ version: 'v3', auth })
}

export async function getOwnChannel(auth: OAuth2Client) {
  const res = await yt(auth).channels.list({ part: ['snippet', 'contentDetails'], mine: true })
  const channel = res.data.items?.[0]
  if (!channel) throw new Error('No YouTube channel found for this Google account.')
  return {
    id: channel.id!,
    title: channel.snippet?.title || 'Untitled channel',
    thumbnailUrl: channel.snippet?.thumbnails?.default?.url || null,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || null,
  }
}

export interface UploadVideoInput {
  filePath: string
  title: string
  description: string
  tags: string[]
  categoryId: string
  privacyStatus: 'private' | 'unlisted' | 'public'
  publishAt?: string // ISO timestamp — requires privacyStatus 'private'
  madeForKids: boolean
  containsSyntheticMedia: boolean
}

// Uses the resumable-upload path built into googleapis' media.body stream
// handling (videos.insert). For files above ~50MB this automatically chunks
// the upload and can resume on transient network failures.
export async function uploadVideo(auth: OAuth2Client, input: UploadVideoInput) {
  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 5000),
      tags: input.tags.slice(0, 500),
      categoryId: input.categoryId,
    },
    status: {
      privacyStatus: input.privacyStatus,
      publishAt: input.publishAt,
      selfDeclaredMadeForKids: input.madeForKids,
      // YouTube's "Altered or synthetic content" disclosure for realistic
      // AI-generated media. See docs/COMPLIANCE.md for when this applies.
      ...(input.containsSyntheticMedia ? { containsSyntheticMedia: true } : {}),
    },
  }

  const res = await yt(auth).videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody,
      media: { body: fs.createReadStream(input.filePath) },
    },
    {
      // googleapis retries transient (5xx/network) failures automatically;
      // the job queue adds a further retry layer around the whole stage.
      retryConfig: { retry: 3, retryDelay: 2000 },
    }
  )

  if (!res.data.id) throw new Error('YouTube upload succeeded but returned no video id.')
  return res.data.id
}

export async function setThumbnail(auth: OAuth2Client, videoId: string, filePath: string) {
  await yt(auth).thumbnails.set({
    videoId,
    media: { body: fs.createReadStream(filePath), mimeType: 'image/png' },
  })
}

export async function insertCaptions(
  auth: OAuth2Client,
  videoId: string,
  srtFilePath: string,
  language = 'en'
) {
  await yt(auth).captions.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        videoId,
        language,
        name: 'English',
        isDraft: false,
      },
    },
    media: { body: fs.createReadStream(srtFilePath), mimeType: 'application/octet-stream' },
  })
}

export async function ensurePlaylist(auth: OAuth2Client, title: string, description: string) {
  const existing = await yt(auth).playlists.list({ part: ['snippet'], mine: true, maxResults: 50 })
  const found = existing.data.items?.find((p) => p.snippet?.title === title)
  if (found?.id) return found.id

  const created = await yt(auth).playlists.insert({
    part: ['snippet', 'status'],
    requestBody: { snippet: { title, description }, status: { privacyStatus: 'public' } },
  })
  if (!created.data.id) throw new Error('Failed to create YouTube playlist.')
  return created.data.id
}

export async function addVideoToPlaylist(auth: OAuth2Client, playlistId: string, videoId: string) {
  await yt(auth).playlistItems.insert({
    part: ['snippet'],
    requestBody: { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } },
  })
}

export async function getVideoProcessingStatus(auth: OAuth2Client, videoId: string) {
  const res = await yt(auth).videos.list({ part: ['status', 'processingDetails'], id: [videoId] })
  const item = res.data.items?.[0]
  return {
    uploadStatus: item?.status?.uploadStatus || 'unknown',
    privacyStatus: item?.status?.privacyStatus || 'unknown',
    processingStatus: item?.processingDetails?.processingStatus || 'unknown',
    failureReason: item?.status?.failureReason || item?.status?.rejectionReason || null,
  }
}

export async function getVideoStatistics(auth: OAuth2Client, videoIds: string[]) {
  if (!videoIds.length) return []
  const res = await yt(auth).videos.list({ part: ['statistics'], id: videoIds })
  return (res.data.items || []).map((item) => ({
    videoId: item.id!,
    views: Number(item.statistics?.viewCount || 0),
    likes: Number(item.statistics?.likeCount || 0),
    comments: Number(item.statistics?.commentCount || 0),
  }))
}
