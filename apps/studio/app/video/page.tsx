'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Film, Gauge, Loader2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import clsx from 'clsx'
import { AiPanel } from '@/components/ai-panel'
import { AdjustSliders, CropRotate, Presets, Section, TextControls } from '@/components/controls'
import { Dropzone, TopBar, useUndoShortcuts } from '@/components/shell'
import { applyPatch, DEFAULT_STATE, formatTime, type EditPatch, type EditState } from '@/lib/edits'
import { downloadBlob, renderEdited, snapshotForAi } from '@/lib/render'
import { useHistory } from '@/lib/use-history'
import type { ExportStage } from '@/lib/video-export'

const PREVIEW_MAX = 960
const LARGE_FILE = 500 * 1024 * 1024
const SPEEDS = [0.5, 1, 1.5, 2]
const SUGGESTIONS = ['Make it vertical for TikTok', 'Keep only the first 15 seconds', 'Cinematic colour grade', 'Slow motion, muted', 'Add title "Day one"']

export default function VideoEditor() {
  const { state, set, commit, undo, redo, reset, canUndo, canRedo } = useHistory<EditState>(DEFAULT_STATE)
  const latest = useRef(state)
  latest.current = state
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ width: number; height: number; duration: number } | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState<{ stage: ExportStage; ratio: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useUndoShortcuts(undo, redo)

  const end = state.trimEnd ?? meta?.duration ?? 0

  const open = useCallback(
    (f: File) => {
      if (!f.type.startsWith('video/')) return setError('That file is not a video. Try MP4, MOV or WebM.')
      setError(f.size > LARGE_FILE ? 'Large file: exporting happens on your device and may be slow or run out of memory. Trim it down first if it fails.' : null)
      if (url) URL.revokeObjectURL(url)
      setMeta(null)
      setPlaying(false)
      setFile(f)
      setUrl(URL.createObjectURL(f))
      reset(DEFAULT_STATE)
    },
    [url, reset],
  )

  const draw = useCallback(() => {
    const v = videoRef.current
    if (v && canvasRef.current && v.videoWidth) renderEdited(v, latest.current, PREVIEW_MAX, canvasRef.current)
  }, [])

  // While playing, draw every frame and loop inside the trim range.
  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => {
      const v = videoRef.current
      if (!v) return
      const stop = latest.current.trimEnd ?? v.duration
      if (v.currentTime >= stop) v.currentTime = latest.current.trimStart
      setTime(v.currentTime)
      draw()
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing, draw])

  useEffect(() => {
    if (!playing) draw()
    const v = videoRef.current
    if (v) {
      v.playbackRate = state.speed
      v.volume = Math.min(1, state.volume)
      v.muted = state.volume === 0
    }
  }, [state, playing, draw])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      setPlaying(false)
    } else {
      if (v.currentTime < state.trimStart || v.currentTime >= end) v.currentTime = state.trimStart
      v.play().then(() => setPlaying(true), () => setError('Playback was blocked by the browser. Click play again.'))
    }
  }

  function seek(t: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    setTime(t)
  }

  async function exportMp4() {
    if (!file || !meta) return
    videoRef.current?.pause()
    setPlaying(false)
    setError(null)
    setProgress({ stage: 'loading', ratio: 0 })
    try {
      const { exportVideo } = await import('@/lib/video-export')
      const blob = await exportVideo(file, state, meta, (stage, ratio) => setProgress({ stage, ratio }))
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}-edited.mp4`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setProgress(null)
    }
  }

  const getContext = () => ({
    state,
    duration: meta?.duration,
    image: videoRef.current?.videoWidth ? snapshotForAi(videoRef.current, state) : undefined,
  })
  const onPatch = (patch: EditPatch) => set(applyPatch(latest.current, patch, meta?.duration))
  const controlProps = { state, onChange: set, onCommit: commit }
  const clipLength = Math.max(0, end - state.trimStart) / state.speed

  return (
    <div className="flex h-screen flex-col">
      <TopBar title={file?.name ?? 'Video editor'} canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}>
        {file ? (
          <button className="btn-primary" onClick={exportMp4} disabled={!meta || Boolean(progress)}>
            <Download className="h-4 w-4" /> Export MP4
          </button>
        ) : null}
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 shrink-0 overflow-y-auto border-ink-700 bg-ink-900 lg:order-1 lg:w-72 lg:border-r">
          {meta ? (
            <>
              <Section title="Speed & sound">
                <div className="mb-3 flex gap-1.5">
                  <Gauge className="mt-1.5 h-4 w-4 shrink-0 text-fg-4" />
                  {SPEEDS.map((s) => (
                    <button key={s} className={clsx('chip flex-1', state.speed === s && 'chip-on')} onClick={() => set({ ...state, speed: s })}>
                      {s}×
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-fg-3 hover:text-fg"
                    aria-label={state.volume === 0 ? 'Unmute' : 'Mute'}
                    onClick={() => set({ ...state, volume: state.volume === 0 ? 1 : 0 })}
                  >
                    {state.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={Math.round(state.volume * 100)}
                    onChange={(e) => set({ ...state, volume: Number(e.target.value) / 100 }, { commit: false })}
                    onPointerUp={commit}
                    aria-label="Volume"
                  />
                  <span className="w-10 text-right text-xs tabular-nums text-fg-3">{Math.round(state.volume * 100)}%</span>
                </div>
              </Section>
              <Presets {...controlProps} />
              <AdjustSliders {...controlProps} />
              <CropRotate {...controlProps} />
              <TextControls {...controlProps} />
            </>
          ) : (
            <p className="p-4 text-sm text-fg-3">Open a video to start editing.</p>
          )}
        </aside>

        <main className="relative order-1 flex min-h-[50vh] min-w-0 flex-1 flex-col lg:order-2">
          {url ? (
            <>
              <div className="checker flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
                <video
                  ref={videoRef}
                  src={url}
                  // Kept in the DOM (not display:none) so every browser keeps decoding frames for the canvas.
                  className="pointer-events-none absolute h-px w-px opacity-0"
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget
                    setMeta({ width: v.videoWidth, height: v.videoHeight, duration: v.duration })
                  }}
                  onLoadedData={draw}
                  onSeeked={draw}
                  onError={() => setError('Your browser cannot play this video format. Try converting it to MP4 (H.264).')}
                />
                <canvas ref={canvasRef} onClick={togglePlay} className="max-h-full max-w-full cursor-pointer rounded shadow-2xl shadow-black/50" />
              </div>
              {meta ? (
                <Timeline
                  duration={meta.duration}
                  time={time}
                  state={state}
                  playing={playing}
                  clipLength={clipLength}
                  onTogglePlay={togglePlay}
                  onSeek={seek}
                  onTrim={(trimStart, trimEnd, commitNow) => set({ ...state, trimStart, trimEnd: trimEnd >= meta.duration - 0.05 ? null : trimEnd }, { commit: commitNow })}
                  onCommit={commit}
                />
              ) : null}
            </>
          ) : (
            <div className="checker flex flex-1 items-center justify-center p-4">
              <div className="w-full max-w-xl">
                <Dropzone accept="video/*" label="Drop a video here or click to browse" hint="MP4, MOV or WebM · edited privately in your browser" onFile={open} />
              </div>
            </div>
          )}
          {error ? (
            <div className="absolute left-1/2 top-4 flex max-w-[90%] -translate-x-1/2 items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-sm text-rose-200">
              {error}
              <button aria-label="Dismiss" onClick={() => setError(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {progress ? <ExportOverlay stage={progress.stage} ratio={progress.ratio} /> : null}
        </main>

        <aside className="order-3 flex h-[420px] shrink-0 flex-col border-ink-700 bg-ink-900 lg:h-auto lg:w-80 lg:border-l">
          <AiPanel mode="video" disabled={!meta} suggestions={SUGGESTIONS} getContext={getContext} onPatch={onPatch} />
        </aside>
      </div>
    </div>
  )
}

interface TimelineProps {
  duration: number
  time: number
  state: EditState
  playing: boolean
  clipLength: number
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onTrim: (start: number, end: number, commit: boolean) => void
  onCommit: () => void
}

function Timeline({ duration, time, state, playing, clipLength, onTogglePlay, onSeek, onTrim, onCommit }: TimelineProps) {
  const end = state.trimEnd ?? duration
  const pct = (t: number) => `${(t / duration) * 100}%`
  return (
    <div className="shrink-0 border-t border-ink-700 bg-ink-900 px-4 py-3">
      <div className="mb-2 flex items-center gap-3 text-xs text-fg-3">
        <button className="btn-primary !h-9 !w-9 !rounded-full !p-0" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="tabular-nums text-fg-2">{formatTime(time)}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Film className="h-3.5 w-3.5" /> Clip {formatTime(state.trimStart)} – {formatTime(end)} · plays {formatTime(clipLength)}
        </span>
      </div>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-md bg-ink-800" />
        <div className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md border-2 border-accent bg-accent-soft" style={{ left: pct(state.trimStart), width: pct(end - state.trimStart) }} />
        <div className="pointer-events-none absolute top-0 h-10 w-0.5 bg-white" style={{ left: pct(time) }} />
        <input
          type="range"
          className="trim absolute inset-0 !h-10 !bg-transparent opacity-0"
          min={0}
          max={duration}
          step={0.01}
          value={time}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Playhead"
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <label className="text-xs text-fg-3">
          Start
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={state.trimStart}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), end - 0.1)
              onTrim(v, end, false)
              onSeek(v)
            }}
            onPointerUp={onCommit}
            aria-label="Trim start"
          />
        </label>
        <label className="text-xs text-fg-3">
          End
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={end}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), state.trimStart + 0.1)
              onTrim(state.trimStart, v, false)
              onSeek(v)
            }}
            onPointerUp={onCommit}
            aria-label="Trim end"
          />
        </label>
      </div>
    </div>
  )
}

function ExportOverlay({ stage, ratio }: { stage: ExportStage; ratio: number }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
      <div className="panel w-80 p-5 text-center">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-accent" />
        <p className="mb-1 font-medium">{stage === 'loading' ? 'Preparing the video engine…' : 'Rendering your video…'}</p>
        <p className="mb-4 text-xs text-fg-3">This runs on your device. Keep this tab open.</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full bg-accent transition-all" style={{ width: `${Math.round((stage === 'loading' ? 0.02 : ratio) * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs tabular-nums text-fg-3">{stage === 'loading' ? 'First export downloads ~30 MB once' : `${Math.round(ratio * 100)}%`}</p>
      </div>
    </div>
  )
}
