'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Eye, ImagePlus, Loader2 } from 'lucide-react'
import { AiPanel } from '@/components/ai-panel'
import { AdjustSliders, CropRotate, Presets, TextControls } from '@/components/controls'
import { Dropzone, TopBar, useUndoShortcuts } from '@/components/shell'
import { applyPatch, applyPreset, DEFAULT_STATE, isNeutral, PRESETS, type EditPatch, type EditState } from '@/lib/edits'
import { canvasToBlob, downloadBlob, renderEdited, snapshotForAi } from '@/lib/render'
import { useHistory } from '@/lib/use-history'

const PREVIEW_MAX = 1600
const SUGGESTIONS = ['Make it warm and golden', 'Moody cinematic look', 'Black and white, high contrast', 'Crop for Instagram', 'Add caption "Summer 2026"']

export default function PhotoEditor() {
  const { state, set, commit, undo, redo, reset, canUndo, canRedo } = useHistory<EditState>(DEFAULT_STATE)
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<HTMLCanvasElement | null>(null) // downscaled copy for fast previews
  const [full, setFull] = useState<HTMLImageElement | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [showOriginal, setShowOriginal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(state)
  latest.current = state
  useUndoShortcuts(undo, redo)

  const open = useCallback(
    (f: File) => {
      if (!f.type.startsWith('image/')) return setError('That file is not an image. Try JPG, PNG, WebP or HEIC exported as JPG.')
      setError(null)
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, PREVIEW_MAX / Math.max(img.naturalWidth, img.naturalHeight))
        const c = document.createElement('canvas')
        c.width = Math.round(img.naturalWidth * scale)
        c.height = Math.round(img.naturalHeight * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        const t: Record<string, string> = {}
        for (const p of PRESETS) t[p.id] = renderEdited(c, { ...applyPreset(DEFAULT_STATE, p.id), aspect: '1:1' }, 120).toDataURL('image/jpeg', 0.7)
        setThumbs(t)
        setFull(img)
        setSource(c)
        setFile(f)
        reset(DEFAULT_STATE)
      }
      img.onerror = () => setError('This image could not be opened by your browser.')
      img.src = url
    },
    [reset],
  )

  // Redraw the preview at most once per animation frame.
  useEffect(() => {
    if (!source || !canvasRef.current) return
    const id = requestAnimationFrame(() => renderEdited(source, showOriginal ? DEFAULT_STATE : state, PREVIEW_MAX, canvasRef.current!))
    return () => cancelAnimationFrame(id)
  }, [source, state, showOriginal])

  async function exportAs(type: 'image/jpeg' | 'image/png') {
    if (!full || !file) return
    setExporting(true)
    try {
      await new Promise((r) => setTimeout(r, 30)) // let the spinner paint before the heavy render
      const blob = await canvasToBlob(renderEdited(full, state, null), type, 0.92)
      const base = file.name.replace(/\.[^.]+$/, '')
      downloadBlob(blob, `${base}-edited.${type === 'image/png' ? 'png' : 'jpg'}`)
    } catch {
      setError('Export failed — the image may be too large for this device.')
    } finally {
      setExporting(false)
    }
  }

  const getContext = () => ({ state, image: source ? snapshotForAi(source, state) : undefined })
  // Apply to the latest state, not the one captured when the request was sent.
  const onPatch = (patch: EditPatch) => set(applyPatch(latest.current, patch))
  const controlProps = { state, onChange: set, onCommit: commit }

  return (
    <div className="flex h-screen flex-col">
      <TopBar title={file?.name ?? 'Photo editor'} canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}>
        {file ? (
          <>
            <button className="btn-ghost hidden sm:inline-flex" onClick={() => exportAs('image/png')} disabled={exporting}>
              PNG
            </button>
            <button className="btn-primary" onClick={() => exportAs('image/jpeg')} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
            </button>
          </>
        ) : null}
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 shrink-0 overflow-y-auto border-ink-700 bg-ink-900 lg:order-1 lg:w-72 lg:border-r">
          {source ? (
            <>
              <Presets {...controlProps} presetThumbs={thumbs} />
              <AdjustSliders {...controlProps} />
              <CropRotate {...controlProps} />
              <TextControls {...controlProps} />
            </>
          ) : (
            <p className="p-4 text-sm text-fg-3">Open a photo to start editing.</p>
          )}
        </aside>

        <main className="checker relative order-1 flex min-h-[50vh] flex-1 items-center justify-center overflow-hidden p-4 lg:order-2">
          {source ? (
            <>
              <canvas ref={canvasRef} className="max-h-full max-w-full rounded shadow-2xl shadow-black/50" />
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                <button
                  className="btn-ghost select-none bg-ink-900/90 backdrop-blur"
                  onPointerDown={() => setShowOriginal(true)}
                  onPointerUp={() => setShowOriginal(false)}
                  onPointerLeave={() => setShowOriginal(false)}
                  disabled={isNeutral(state)}
                >
                  <Eye className="h-4 w-4" /> Hold to compare
                </button>
                <label className="btn-ghost cursor-pointer bg-ink-900/90 backdrop-blur">
                  <ImagePlus className="h-4 w-4" /> Open another
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
                </label>
              </div>
            </>
          ) : (
            <div className="w-full max-w-xl">
              <Dropzone accept="image/*" label="Drop a photo here or click to browse" hint="JPG, PNG or WebP · edited privately in your browser" onFile={open} />
            </div>
          )}
          {error ? <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        </main>

        <aside className="order-3 flex h-[420px] shrink-0 flex-col border-ink-700 bg-ink-900 lg:h-auto lg:w-80 lg:border-l">
          <AiPanel mode="photo" disabled={!source} suggestions={SUGGESTIONS} getContext={getContext} onPatch={onPatch} />
        </aside>
      </div>
    </div>
  )
}
