import Link from 'next/link'
import { ShieldCheck, Sparkles, Youtube, Gauge } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-xl font-bold text-brand">
          <Youtube className="h-6 w-6" /> YT Automation
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-neutral-700 hover:text-brand">Log in</Link>
          <Link href="/register" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Run a YouTube channel <span className="text-brand">without running it yourself</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">
          Original scripts, licensed footage, AI voice-over, subtitles and thumbnails — researched,
          quality-checked and copyright-checked before anything gets near your channel. You stay in
          control with Manual, Assisted, or Full Automation modes and one emergency pause button.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">Start free</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-6 py-10 sm:grid-cols-3">
        {[
          { icon: Sparkles, title: 'Original by construction', desc: 'Every script is sourced, fact-checked and originality-scored before it renders.' },
          { icon: ShieldCheck, title: 'Compliance built in', desc: 'Copyright, policy, disclosure and misleading-content checks gate every upload.' },
          { icon: Gauge, title: 'You approve the pace', desc: 'Manual, Assisted or Full Automation — plus a pause button that stops everything instantly.' },
        ].map((f) => (
          <div key={f.title} className="card">
            <f.icon className="h-6 w-6 text-brand" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} YT Automation
      </footer>
    </main>
  )
}
