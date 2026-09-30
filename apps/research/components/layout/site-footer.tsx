import Link from 'next/link'

export const DISCLAIMER =
  'This platform provides financial information, research tools and educational analysis. It does not constitute personalised financial advice. Investments can fall as well as rise in value, and past performance does not guarantee future results.'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-700/80 bg-ink-950">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <p className="max-w-4xl text-sm leading-relaxed text-fg-2">{DISCLAIMER}</p>
        <p className="mt-3 max-w-4xl text-xs leading-relaxed text-fg-3">
          Scores measure the strength of evidence under a published, deterministic methodology. They are not probabilities of a price rise and not recommendations to buy or sell.
          Figures marked <span className="text-neu">DEMO DATA</span> are illustrative and have not been verified against company filings.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-fg-3">
          <Link href="/methodology" className="hover:text-fg">
            Scoring methodology
          </Link>
          <Link href="/academy" className="hover:text-fg">
            Investment Academy
          </Link>
          <span>© {new Date().getFullYear()} Evidentia Research</span>
        </div>
      </div>
    </footer>
  )
}
