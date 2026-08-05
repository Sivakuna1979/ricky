import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import {
  getImageGenProvider,
  getMusicProvider,
  getResearchProvider,
  getScriptAIProvider,
  getStockMediaProvider,
  getTTSProvider,
} from '@/lib/providers/factory'
import { assertWithinSpendLimits } from '@/lib/pipeline/cost'
import { detectSensitivity, dedupHash, findDuplicateTopic, generateTopicCandidates } from '@/lib/pipeline/topics'
import { researchTopic, saveResearch, verifySourceQuality } from '@/lib/pipeline/research'
import {
  checkHookRepetition,
  checkScriptOriginality,
  generateScript,
  reviewScriptQuality,
} from '@/lib/pipeline/script'
import { generateVoiceover } from '@/lib/pipeline/voiceover'
import { planAndFetchVisuals, planMusic } from '@/lib/pipeline/visual-plan'
import { buildSrtFromScenes, buildSrtFromWordTimings } from '@/lib/pipeline/subtitles'
import { buildThumbnailPrompt, generateThumbnailBackground } from '@/lib/pipeline/thumbnail'
import { generateMetadata } from '@/lib/pipeline/metadata'
import {
  allBlockingChecksPassed,
  assessSyntheticMediaDisclosure,
  checkAssetLicenses,
  checkImpersonationRisk,
  checkMusicLicensed,
  checkTitleNotMisleading,
  persistChecks,
  reviewAdvertiserFriendliness,
  scanProhibitedKeywords,
} from '@/lib/pipeline/safety'
import { notify } from '@/lib/pipeline/notifications'
import { getAuthorizedClientForChannel } from '@/lib/youtube/oauth'
import { addVideoToPlaylist, ensurePlaylist, insertCaptions, setThumbnail, uploadVideo } from '@/lib/youtube/client'
import { renderVideo, overlayThumbnailText, type SceneInput } from './ffmpeg'
import type { ProduceVideoJobData } from '@/lib/queue/queues'

const QUALITY_SCORE_THRESHOLD = 6.5

class PipelinePaused extends Error {
  constructor(stage: string) {
    super(`Pipeline paused for approval at stage: ${stage}`)
    this.name = 'PipelinePaused'
  }
}

class PipelineAborted extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'PipelineAborted'
  }
}

async function checkPause(supabase: SupabaseClient, userId: string, channelId: string) {
  const [{ data: profile }, { data: channel }] = await Promise.all([
    supabase.from('yt_profiles').select('is_paused').eq('id', userId).single(),
    supabase.from('yt_channels').select('is_paused').eq('id', channelId).single(),
  ])
  if (profile?.is_paused) throw new PipelineAborted('Automation is globally paused (emergency pause is active).')
  if (channel?.is_paused) throw new PipelineAborted('This channel is paused.')
}

async function requestApproval(
  supabase: SupabaseClient,
  input: { channelId: string; userId: string; entityType: 'topic' | 'script' | 'video' | 'thumbnail'; entityId: string; title: string }
) {
  await supabase.from('yt_approvals').insert({
    channel_id: input.channelId,
    entity_type: input.entityType,
    entity_id: input.entityId,
  })
  await notify(supabase, {
    userId: input.userId,
    type: 'approval_required',
    title: `Approval needed: ${input.title}`,
    body: `A new ${input.entityType} is ready for your review before the pipeline continues.`,
    relatedEntity: { entityType: input.entityType, entityId: input.entityId, channelId: input.channelId },
  })
}

export async function runProduceVideoJob(data: ProduceVideoJobData) {
  const supabase = createAdminClient()

  const { data: schedule, error: scheduleError } = await supabase
    .from('yt_schedules')
    .select('id, channel_id, video_kind, status')
    .eq('id', data.scheduleId)
    .single()
  if (scheduleError) throw scheduleError
  if (schedule.status !== 'planned') return // already produced or skipped

  const { data: channel, error: channelError } = await supabase
    .from('yt_channels')
    .select('id, user_id, youtube_channel_id, title')
    .eq('id', data.channelId)
    .single()
  if (channelError) throw channelError

  const { data: settings, error: settingsError } = await supabase
    .from('yt_channel_settings')
    .select('*, yt_niches(*)')
    .eq('channel_id', data.channelId)
    .single()
  if (settingsError) throw settingsError

  try {
    await checkPause(supabase, channel.user_id, channel.id)
    await assertWithinSpendLimits(supabase, channel.user_id)

    const ai = await getScriptAIProvider(supabase, channel.user_id)

    // ---- Topic discovery, scoring, dedup ----
    const { data: recentTopics } = await supabase
      .from('yt_topics')
      .select('title')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const niche = settings.yt_niches
    const candidates = await generateTopicCandidates(ai, {
      nicheName: niche?.name ?? 'general',
      nicheDescription: niche?.description ?? '',
      allowedVideoTypes: settings.allowed_video_types,
      recentTitles: (recentTopics ?? []).map((t) => t.title),
      count: 5,
    })

    let chosen = null as (typeof candidates)[number] | null
    for (const c of candidates.sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total)) {
      if (c.isSensitiveTopic && !niche?.safeguards_acknowledged) continue
      const dup = await findDuplicateTopic(supabase, channel.id, c.title)
      if (dup.duplicate) continue
      chosen = c
      break
    }
    if (!chosen) {
      throw new PipelineAborted('No non-duplicate, non-sensitive topic candidate scored well enough this run.')
    }

    const { data: topicRow, error: topicInsertError } = await supabase
      .from('yt_topics')
      .insert({
        channel_id: channel.id,
        niche_id: niche?.id ?? null,
        schedule_id: schedule.id,
        title: chosen.title,
        angle: chosen.angle,
        video_type: chosen.videoType,
        format: data.videoKind,
        target_keywords: chosen.targetKeywords,
        score: chosen.scoreBreakdown.total,
        score_breakdown: chosen.scoreBreakdown,
        dedup_hash: dedupHash(chosen.title),
        is_sensitive_topic: chosen.isSensitiveTopic,
        status: settings.approval_mode === 'manual' ? 'proposed' : 'approved',
      })
      .select('id')
      .single()
    if (topicInsertError) throw topicInsertError

    if (settings.approval_mode === 'manual') {
      await requestApproval(supabase, {
        channelId: channel.id,
        userId: channel.user_id,
        entityType: 'topic',
        entityId: topicRow.id,
        title: chosen.title,
      })
      throw new PipelinePaused('topic')
    }

    await continueFromApprovedTopic(supabase, {
      channelId: channel.id,
      userId: channel.user_id,
      scheduleId: schedule.id,
      videoKind: data.videoKind,
      topicId: topicRow.id,
      approvalMode: settings.approval_mode,
      productionMode: settings.production_mode,
    })
  } catch (err) {
    if (err instanceof PipelinePaused) return
    await supabase.from('yt_schedules').update({ status: 'failed' }).eq('id', schedule.id)
    if (err instanceof PipelineAborted) {
      await notify(supabase, {
        userId: channel.user_id,
        type: 'render_failed',
        title: 'Production run stopped',
        body: err.message,
      })
      return
    }
    throw err
  }
}

export async function continueFromApprovedTopic(
  supabase: SupabaseClient,
  ctx: {
    channelId: string
    userId: string
    scheduleId: string
    videoKind: 'short' | 'long'
    topicId: string
    approvalMode: 'manual' | 'assisted' | 'full_auto'
    productionMode: 'low_cost' | 'standard' | 'premium'
  }
) {
  const { data: topic, error: topicError } = await supabase.from('yt_topics').select('*').eq('id', ctx.topicId).single()
  if (topicError) throw topicError

  const ai = await getScriptAIProvider(supabase, ctx.userId)
  const research = await getResearchProvider(supabase, ctx.userId)

  const researchResult = await researchTopic(research, ai, {
    title: topic.title,
    angle: topic.angle,
    keywords: topic.target_keywords,
    requireRecent: topic.video_type === 'news',
  })
  await saveResearch(supabase, topic.id, researchResult)
  const verification = verifySourceQuality(researchResult.facts, researchResult.sources)
  if (!verification.passed && topic.video_type === 'news') {
    throw new PipelineAborted('News-style video requires reliable, well-sourced claims — sourcing was too weak.')
  }

  const script = await generateScript(ai, {
    title: topic.title,
    angle: topic.angle,
    videoType: topic.video_type,
    videoKind: ctx.videoKind,
    facts: researchResult.facts,
    recentHooks: await getRecentHooks(supabase, ctx.channelId),
  })

  const quality = await reviewScriptQuality(ai, { title: topic.title, fullText: script.fullText, scenes: script.scenes })
  const originality = await checkScriptOriginality(
    supabase,
    ctx.channelId,
    null,
    script.fullText,
    researchResult.sources.map((s) => s.snippet)
  )
  const hookCheck = await checkHookRepetition(supabase, ctx.channelId, script.hook)

  const { data: scriptRow, error: scriptInsertError } = await supabase
    .from('yt_scripts')
    .insert({
      topic_id: topic.id,
      content: script.fullText,
      hook: script.hook,
      structure: script.scenes,
      word_count: script.wordCount,
      estimated_duration_seconds: script.estimatedDurationSeconds,
      originality_score: originality.originalityScore,
      plagiarism_report: originality,
      quality_score: quality.overall,
      quality_feedback: quality,
      hook_repetition_flag: hookCheck.repeated,
      ai_disclosure_required: true,
      status: ctx.approvalMode === 'manual' ? 'draft' : 'approved',
    })
    .select('id')
    .single()
  if (scriptInsertError) throw scriptInsertError

  if (quality.verdict === 'reject' || !originality.passed || hookCheck.repeated) {
    await supabase.from('yt_scripts').update({ status: 'rejected' }).eq('id', scriptRow.id)
    throw new PipelineAborted(
      `Script failed quality/originality gate (verdict=${quality.verdict}, originality=${originality.originalityScore}, hookRepeated=${hookCheck.repeated}).`
    )
  }

  await supabase.from('yt_topics').update({ status: 'in_production' }).eq('id', topic.id)

  if (ctx.approvalMode === 'manual') {
    await requestApproval(supabase, {
      channelId: ctx.channelId,
      userId: ctx.userId,
      entityType: 'script',
      entityId: scriptRow.id,
      title: topic.title,
    })
    return
  }

  await produceVideoFromScript(supabase, {
    channelId: ctx.channelId,
    userId: ctx.userId,
    scheduleId: ctx.scheduleId,
    videoKind: ctx.videoKind,
    topicId: topic.id,
    scriptId: scriptRow.id,
    approvalMode: ctx.approvalMode,
    productionMode: ctx.productionMode,
  })
}

async function getRecentHooks(supabase: SupabaseClient, channelId: string) {
  const { data } = await supabase
    .from('yt_scripts')
    .select('hook, yt_topics!inner(channel_id, created_at)')
    .eq('yt_topics.channel_id', channelId)
    .order('created_at', { ascending: false, foreignTable: 'yt_topics' })
    .limit(20)
  return (data ?? []).map((r) => r.hook)
}

export async function produceVideoFromScript(
  supabase: SupabaseClient,
  ctx: {
    channelId: string
    userId: string
    scheduleId: string
    videoKind: 'short' | 'long'
    topicId: string
    scriptId: string
    approvalMode: 'manual' | 'assisted' | 'full_auto'
    productionMode: 'low_cost' | 'standard' | 'premium'
  }
) {
  const aspectRatio = ctx.videoKind === 'short' ? ('9:16' as const) : ('16:9' as const)
  const { data: script, error: scriptError } = await supabase.from('yt_scripts').select('*').eq('id', ctx.scriptId).single()
  if (scriptError) throw scriptError

  const { data: videoRow, error: videoInsertError } = await supabase
    .from('yt_videos')
    .insert({
      channel_id: ctx.channelId,
      topic_id: ctx.topicId,
      script_id: ctx.scriptId,
      aspect_ratio: aspectRatio,
      video_kind: ctx.videoKind,
      render_status: 'planning',
      production_mode: ctx.productionMode,
      ai_disclosure_applied: true,
    })
    .select('id')
    .single()
  if (videoInsertError) throw videoInsertError
  const videoId = videoRow.id as string

  const tts = await getTTSProvider(supabase, ctx.userId)
  const voices = await tts.listVoices()
  const voiceover = await generateVoiceover(supabase, tts, {
    scriptId: ctx.scriptId,
    channelId: ctx.channelId,
    text: script.content,
    voiceId: voices[0]?.id ?? 'alloy',
  })
  await supabase.from('yt_videos').update({ voiceover_id: voiceover.voiceoverId }).eq('id', videoId)

  const [stock, imageGen, music] = await Promise.all([
    getStockMediaProvider(supabase, ctx.userId),
    getImageGenProvider(supabase, ctx.userId),
    getMusicProvider(supabase, ctx.userId),
  ])

  const scenes = script.structure as Array<{ index: number; text: string; visual_direction: string; duration_seconds: number }>
  const visuals = await planAndFetchVisuals(supabase, { stock, imageGen }, {
    videoId,
    channelId: ctx.channelId,
    scenes,
    aspectRatio,
    style: ctx.productionMode === 'premium' ? 'cinematic photorealistic' : 'clean modern flat-illustration',
  })
  const musicTrack = await planMusic(supabase, music, {
    videoId,
    mood: 'neutral upbeat',
    minDurationSeconds: voiceover.durationSeconds,
  }).catch(() => null) // missing music library must not hard-fail the MVP pipeline

  const srt = voiceover.wordTimings.length ? buildSrtFromWordTimings(voiceover.wordTimings) : buildSrtFromScenes(scenes)

  // ---- Download everything to a scratch dir and render with ffmpeg ----
  const workDir = path.join(os.tmpdir(), `yt-render-${videoId}-${randomUUID()}`)
  await fs.mkdir(workDir, { recursive: true })
  try {
    const sceneInputs: SceneInput[] = []
    for (const asset of visuals) {
      const scene = scenes.find((s) => s.index === asset.sceneIndex)!
      const { data: blob, error } = await supabase.storage.from('media').download(asset.storagePath)
      if (error) throw error
      const ext = asset.assetType === 'stock_video' ? 'mp4' : asset.storagePath.endsWith('.png') ? 'png' : 'jpg'
      const localPath = path.join(workDir, `scene-${asset.sceneIndex}.${ext}`)
      await fs.writeFile(localPath, Buffer.from(await blob.arrayBuffer()))
      sceneInputs.push({ filePath: localPath, isVideo: asset.assetType === 'stock_video', durationSeconds: scene.duration_seconds })
    }

    const { data: voiceBlob, error: voiceErr } = await supabase.storage.from('media').download(voiceover.storagePath)
    if (voiceErr) throw voiceErr
    const voicePath = path.join(workDir, 'voice.mp3')
    await fs.writeFile(voicePath, Buffer.from(await voiceBlob.arrayBuffer()))

    let musicPath: string | null = null
    if (musicTrack) {
      const musicRes = await fetch(musicTrack.url)
      musicPath = path.join(workDir, 'music.mp3')
      await fs.writeFile(musicPath, Buffer.from(await musicRes.arrayBuffer()))
    }

    const srtPath = path.join(workDir, 'subs.srt')
    await fs.writeFile(srtPath, srt, 'utf8')

    const { width, height } = aspectRatio === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
    const outputPath = path.join(workDir, 'output.mp4')

    await supabase.from('yt_videos').update({ render_status: 'rendering' }).eq('id', videoId)
    await renderVideo({ scenes: sceneInputs, voiceoverPath: voicePath, musicPath, srtPath, outputPath, width, height })

    const rendered = await fs.readFile(outputPath)
    const storagePath = `videos/${videoId}/final.mp4`
    const { error: uploadErr } = await supabase.storage.from('media').upload(storagePath, rendered, { contentType: 'video/mp4', upsert: true })
    if (uploadErr) throw uploadErr

    const subtitlesPath = `videos/${videoId}/subs.srt`
    await supabase.storage.from('media').upload(subtitlesPath, srt, { contentType: 'text/plain', upsert: true })

    await supabase
      .from('yt_videos')
      .update({
        render_status: 'rendered',
        storage_path: storagePath,
        subtitles_path: subtitlesPath,
        duration_seconds: voiceover.durationSeconds,
        resolution: `${width}x${height}`,
      })
      .eq('id', videoId)

    // ---- Thumbnail ----
    const highlightScene = scenes[0]
    const thumbPlan = buildThumbnailPrompt(script.content.slice(0, 60), 'bold high-contrast YouTube thumbnail', highlightScene.visual_direction)
    const bgPath = await generateThumbnailBackground(supabase, imageGen, {
      videoId,
      channelId: ctx.channelId,
      prompt: thumbPlan.backgroundPrompt,
      aspectRatio,
      variant: 'A',
    })
    const { data: bgBlob } = await supabase.storage.from('media').download(bgPath)
    const localBg = path.join(workDir, 'thumb-bg.png')
    await fs.writeFile(localBg, Buffer.from(await bgBlob!.arrayBuffer()))
    const localThumb = path.join(workDir, 'thumb-final.png')
    await overlayThumbnailText({ backgroundPath: localBg, outputPath: localThumb, text: thumbPlan.overlayText, width: aspectRatio === '9:16' ? 1080 : 1280, height: aspectRatio === '9:16' ? 1920 : 720 })
    const thumbFinalPath = `thumbnails/${videoId}/final.png`
    await supabase.storage.from('media').upload(thumbFinalPath, await fs.readFile(localThumb), { contentType: 'image/png', upsert: true })
    await supabase.from('yt_thumbnails').insert({ video_id: videoId, storage_path: thumbFinalPath, variant: 'A', is_selected: true, source: 'ai_generated' })

    // ---- Metadata ----
    const ai = await getScriptAIProvider(supabase, ctx.userId)
    const { data: sources } = await supabase.from('yt_research_sources').select('url, title').eq('topic_id', ctx.topicId)
    const metadata = await generateMetadata(ai, {
      workingTitle: script.content.slice(0, 60),
      fullScript: script.content,
      scenes,
      videoKind: ctx.videoKind,
      sources: sources ?? [],
    })
    await supabase.from('yt_video_metadata').insert({
      video_id: videoId,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      hashtags: metadata.hashtags,
      chapters: metadata.chapters,
      pinned_comment: metadata.pinnedComment,
      contains_synthetic_media: true,
    })

    // ---- Copyright & policy checks ----
    const { data: mediaAssets } = await supabase.from('yt_media_assets').select('asset_type, license_type, license_url').eq('video_id', videoId)
    const policyResults = [
      scanProhibitedKeywords(script.content),
      await reviewAdvertiserFriendliness(ai, script.content),
      await checkTitleNotMisleading(ai, metadata.title, script.content),
      await checkImpersonationRisk(script.content, thumbPlan.backgroundPrompt),
      assessSyntheticMediaDisclosure(script.content),
    ]
    const copyrightResults = [
      checkAssetLicenses((mediaAssets ?? []).map((a) => ({ assetType: a.asset_type, licenseType: a.license_type, licenseUrl: a.license_url }))),
      checkMusicLicensed((mediaAssets ?? []).map((a) => ({ assetType: a.asset_type, licenseType: a.license_type, licenseUrl: a.license_url }))),
    ]
    await persistChecks(supabase, videoId, policyResults, copyrightResults)

    const blockingOk = allBlockingChecksPassed(policyResults) && allBlockingChecksPassed(copyrightResults)
    const qualityScore = Math.round(((script.quality_score ?? 0) + (script.originality_score ?? 0)) / 2 * 10) / 10
    await supabase.from('yt_videos').update({ quality_score: qualityScore }).eq('id', videoId)

    if (!blockingOk) {
      await notify(supabase, {
        userId: ctx.userId,
        type: 'policy_warning',
        title: `Policy/copyright check failed: ${metadata.title}`,
        body: 'One or more blocking checks failed. Review the video in the dashboard before it can be published.',
        relatedEntity: { videoId },
      })
      await supabase.from('yt_schedules').update({ status: 'failed', video_id: videoId }).eq('id', ctx.scheduleId)
      return
    }

    if (ctx.approvalMode === 'full_auto' && qualityScore >= QUALITY_SCORE_THRESHOLD) {
      await runUploadStage(supabase, { videoId, channelId: ctx.channelId, userId: ctx.userId, scheduleId: ctx.scheduleId })
      return
    }

    // manual mode never reaches here (it stops earlier); assisted mode and
    // any full_auto video that missed the quality bar wait for a human.
    await requestApproval(supabase, {
      channelId: ctx.channelId,
      userId: ctx.userId,
      entityType: 'video',
      entityId: videoId,
      title: metadata.title,
    })
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

export async function runUploadStage(
  supabase: SupabaseClient,
  ctx: { videoId: string; channelId: string; userId: string; scheduleId: string }
) {
  await checkPause(supabase, ctx.userId, ctx.channelId)

  const [{ data: video }, { data: metadata }, { data: channel }, { data: schedule }, { data: thumbnail }] = await Promise.all([
    supabase.from('yt_videos').select('*').eq('id', ctx.videoId).single(),
    supabase.from('yt_video_metadata').select('*').eq('video_id', ctx.videoId).single(),
    supabase.from('yt_channels').select('*').eq('id', ctx.channelId).single(),
    supabase.from('yt_schedules').select('*').eq('id', ctx.scheduleId).single(),
    supabase.from('yt_thumbnails').select('*').eq('video_id', ctx.videoId).eq('is_selected', true).single(),
  ])
  if (!video || !metadata || !channel || !schedule) throw new Error('Missing data for upload stage.')

  const auth = await getAuthorizedClientForChannel(supabase, channel)

  const workDir = path.join(os.tmpdir(), `yt-upload-${ctx.videoId}-${randomUUID()}`)
  await fs.mkdir(workDir, { recursive: true })

  const publishAtIso = new Date(`${schedule.slot_date}T${schedule.slot_time}`).toISOString()

  const { data: uploadRow, error: uploadInsertError } = await supabase
    .from('yt_uploads')
    .insert({ video_id: ctx.videoId, channel_id: ctx.channelId, schedule_id: ctx.scheduleId, upload_status: 'uploading', privacy_status: 'private', publish_at: publishAtIso })
    .select('id')
    .single()
  if (uploadInsertError) throw uploadInsertError

  try {
    const { data: videoBlob, error: videoDlErr } = await supabase.storage.from('media').download(video.storage_path)
    if (videoDlErr) throw videoDlErr
    const videoPath = path.join(workDir, 'final.mp4')
    await fs.writeFile(videoPath, Buffer.from(await videoBlob.arrayBuffer()))

    const youtubeVideoId = await uploadVideo(auth, {
      filePath: videoPath,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: metadata.category_id,
      privacyStatus: 'private',
      publishAt: publishAtIso,
      madeForKids: metadata.made_for_kids,
      containsSyntheticMedia: metadata.contains_synthetic_media,
    })

    if (thumbnail) {
      const { data: thumbBlob } = await supabase.storage.from('media').download(thumbnail.storage_path)
      if (thumbBlob) {
        const thumbPath = path.join(workDir, 'thumb.png')
        await fs.writeFile(thumbPath, Buffer.from(await thumbBlob.arrayBuffer()))
        await setThumbnail(auth, youtubeVideoId, thumbPath)
      }
    }

    if (video.subtitles_path) {
      const { data: srtBlob } = await supabase.storage.from('media').download(video.subtitles_path)
      if (srtBlob) {
        const srtPath = path.join(workDir, 'subs.srt')
        await fs.writeFile(srtPath, Buffer.from(await srtBlob.arrayBuffer()))
        await insertCaptions(auth, youtubeVideoId, srtPath, 'en')
      }
    }

    const playlistTitle = video.video_kind === 'short' ? 'Shorts' : 'Full Videos'
    const playlistId = await ensurePlaylist(auth, playlistTitle, `Auto-organised ${playlistTitle.toLowerCase()}`)
    await addVideoToPlaylist(auth, playlistId, youtubeVideoId)

    await supabase
      .from('yt_uploads')
      .update({ youtube_video_id: youtubeVideoId, upload_status: 'scheduled', privacy_status: 'private', publish_at: publishAtIso, uploaded_at: new Date().toISOString() })
      .eq('id', uploadRow.id)
    await supabase.from('yt_schedules').update({ status: 'filled', video_id: ctx.videoId }).eq('id', ctx.scheduleId)

    await notify(supabase, {
      userId: ctx.userId,
      type: 'video_scheduled',
      title: `Scheduled: ${metadata.title}`,
      body: `Uploaded and scheduled to publish at ${publishAtIso}.`,
      relatedEntity: { videoId: ctx.videoId, youtubeVideoId },
    })
  } catch (err) {
    const { data: current } = await supabase.from('yt_uploads').select('retry_count').eq('id', uploadRow.id).single()
    await supabase
      .from('yt_uploads')
      .update({
        upload_status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
        retry_count: (current?.retry_count ?? 0) + 1,
      })
      .eq('id', uploadRow.id)
    await notify(supabase, {
      userId: ctx.userId,
      type: 'upload_failed',
      title: 'YouTube upload failed',
      body: err instanceof Error ? err.message : String(err),
      relatedEntity: { videoId: ctx.videoId },
    })
    throw err
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

// ---- Resume entry points, used by the "Approve" dashboard actions ----
// (see app/api/approvals/[id]/decide/route.ts). Each loads the context a
// fresh worker process needs from the database rather than trusting a
// long-lived in-memory job — approvals can arrive minutes or hours after
// the pipeline paused.

async function loadChannelAndSettings(supabase: SupabaseClient, channelId: string) {
  const [{ data: channel, error: channelError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('yt_channels').select('id, user_id').eq('id', channelId).single(),
    supabase.from('yt_channel_settings').select('approval_mode, production_mode').eq('channel_id', channelId).single(),
  ])
  if (channelError) throw channelError
  if (settingsError) throw settingsError
  return { channel, settings }
}

export async function resumeTopicApproval(topicId: string) {
  const supabase = createAdminClient()
  const { data: topic, error } = await supabase.from('yt_topics').select('id, channel_id, schedule_id, status').eq('id', topicId).single()
  if (error) throw error
  if (topic.status !== 'approved' || !topic.schedule_id) return

  const { channel, settings } = await loadChannelAndSettings(supabase, topic.channel_id)
  await checkPause(supabase, channel.user_id, channel.id)

  await continueFromApprovedTopic(supabase, {
    channelId: channel.id,
    userId: channel.user_id,
    scheduleId: topic.schedule_id,
    videoKind: (await supabase.from('yt_schedules').select('video_kind').eq('id', topic.schedule_id).single()).data!.video_kind,
    topicId: topic.id,
    approvalMode: settings.approval_mode,
    productionMode: settings.production_mode,
  })
}

export async function resumeScriptApproval(scriptId: string) {
  const supabase = createAdminClient()
  const { data: script, error } = await supabase.from('yt_scripts').select('id, status, topic_id, yt_topics(channel_id, schedule_id)').eq('id', scriptId).single()
  if (error) throw error
  if (script.status !== 'approved') return
  const topic = Array.isArray(script.yt_topics) ? script.yt_topics[0] : script.yt_topics
  if (!topic?.schedule_id) return

  const { channel, settings } = await loadChannelAndSettings(supabase, topic.channel_id)
  await checkPause(supabase, channel.user_id, channel.id)
  const { data: scheduleRow } = await supabase.from('yt_schedules').select('video_kind').eq('id', topic.schedule_id).single()

  await produceVideoFromScript(supabase, {
    channelId: channel.id,
    userId: channel.user_id,
    scheduleId: topic.schedule_id,
    videoKind: scheduleRow!.video_kind,
    topicId: script.topic_id,
    scriptId: script.id,
    approvalMode: settings.approval_mode,
    productionMode: settings.production_mode,
  })
}

export async function resumeVideoApproval(videoId: string) {
  const supabase = createAdminClient()
  const { data: video, error } = await supabase.from('yt_videos').select('id, channel_id, topic_id, yt_topics(schedule_id)').eq('id', videoId).single()
  if (error) throw error
  const topic = Array.isArray(video.yt_topics) ? video.yt_topics[0] : video.yt_topics
  if (!topic?.schedule_id) throw new Error('Video has no associated schedule slot to publish into.')

  const { channel } = await loadChannelAndSettings(supabase, video.channel_id)
  await runUploadStage(supabase, { videoId: video.id, channelId: video.channel_id, userId: channel.user_id, scheduleId: topic.schedule_id })
}
