import Link from 'next/link'
import { Clapperboard, ImageIcon, Lock, Sparkles, Zap } from 'lucide-react'
import { Logo } from '@/components/shell'

const FEATURES = [
  { icon: Sparkles, title: 'Edit by describing it', body: '“Make it warmer and crop for Instagram.” Claude looks at your photo or frame and sets everything for you.' },
  { icon: Lock, title: 'Private by design', body: 'Editing and exporting run in your browser. Only a small preview goes to the AI when you ask it something.' },
  { icon: Zap, title: 'No render queue', body: 'Live preview while you edit. Export full-resolution JPG/PNG or MP4 straight from the page.' },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center px-4 py-5">
        <Logo />
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-16">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-3 py-1 text-xs text-fg-3">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Powered by Claude
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Photo and video editing,{' '}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">just say what you want</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-fg-3">Colour grading, crops for every platform, captions, trimming and speed — with an AI assistant that does the fiddly parts.</p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <Link href="/photo" className="panel group p-6 text-left transition hover:border-accent">
            <ImageIcon className="mb-4 h-8 w-8 text-accent" />
            <h2 className="text-lg font-semibold">Edit a photo</h2>
            <p className="mt-1 text-sm text-fg-3">Looks, adjustments, crop, text. Export JPG or PNG.</p>
            <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">Open photo editor →</span>
          </Link>
          <Link href="/video" className="panel group p-6 text-left transition hover:border-accent">
            <Clapperboard className="mb-4 h-8 w-8 text-accent" />
            <h2 className="text-lg font-semibold">Edit a video</h2>
            <p className="mt-1 text-sm text-fg-3">Trim, speed, colour, vertical crops, titles. Export MP4.</p>
            <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">Open video editor →</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel p-5">
            <f.icon className="mb-3 h-5 w-5 text-accent" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-fg-3">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
