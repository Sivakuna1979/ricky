import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'
import { LESSONS } from '@/lib/content/academy'

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const l = LESSONS.find((x) => x.slug === params.slug)
  return { title: l ? l.title : 'Lesson', description: l?.summary }
}

export default function LessonPage({ params }: { params: { slug: string } }) {
  const idx = LESSONS.findIndex((x) => x.slug === params.slug)
  if (idx < 0) notFound()
  const l = LESSONS[idx]
  const next = LESSONS[idx + 1]
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/academy" className="text-sm text-accent hover:underline">
        ← Investment Academy
      </Link>
      <div className="label mt-4">
        {l.track} · {l.minutes} min read
      </div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg">{l.title}</h1>
      <p className="mt-3 text-lg text-fg-2">{l.summary}</p>
      <div className="mt-8 space-y-6">
        {l.sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-2 text-lg font-semibold text-fg">{s.h}</h2>
            {s.p.map((para) => (
              <p key={para} className="mb-3 leading-relaxed text-fg-2">
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>
      <div className="card card-pad mt-8">
        <h2 className="label mb-3">Key takeaways</h2>
        <ul className="space-y-2">
          {l.takeaways.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-fg-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-pos" /> {t}
            </li>
          ))}
        </ul>
        {l.onPlatform && <p className="mt-4 text-sm text-fg-3">On the platform: {l.onPlatform}</p>}
      </div>
      <p className="mt-6 text-xs text-fg-4">Educational content only — not personalised financial advice.</p>
      {next && (
        <Link href={`/academy/${next.slug}`} className="btn mt-6">
          Next: {next.title} →
        </Link>
      )}
    </article>
  )
}
