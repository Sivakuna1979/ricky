import Link from 'next/link'
import { LESSONS, TRACKS } from '@/lib/content/academy'

export const metadata = { title: 'Investment Academy' }

export default function AcademyPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <header>
        <div className="label">Investment Academy</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg">Learn to read a company</h1>
        <p className="mt-2 max-w-3xl text-fg-3">
          Plain-language lessons on the ideas behind every number on the platform. Classic-book guides explain widely discussed concepts in our own words — they are not summaries or excerpts of the books.
        </p>
      </header>
      {TRACKS.map((track) => (
        <section key={track} aria-labelledby={`t-${track}`}>
          <h2 id={`t-${track}`} className="mb-3 text-lg font-semibold text-fg">
            {track}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LESSONS.filter((l) => l.track === track).map((l) => (
              <Link key={l.slug} href={`/academy/${l.slug}`} className="card card-pad block transition hover:border-accent/50">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-fg">{l.title}</h3>
                  <span className="shrink-0 text-xs text-fg-4">{l.minutes} min</span>
                </div>
                <p className="mt-1 text-sm text-fg-3">{l.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
