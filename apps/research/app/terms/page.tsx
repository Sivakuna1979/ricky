import { DISCLAIMER_TEXT } from '@/lib/content/disclaimer'

export const metadata = { title: 'Terms of use' }

/** Plain-English starting template — have it reviewed by a qualified person before charging. */
export default function TermsPage() {
  const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{h}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-fg-2">{children}</div>
    </section>
  )
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Terms of use</h1>
        <p className="mt-1 text-sm text-fg-4">Free beta · Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </header>
      <S h="Information, not advice">
        <p>{DISCLAIMER_TEXT}</p>
        <p>
          Nothing on this website is a recommendation to buy, sell or hold any investment, and nothing takes account of your personal circumstances. Scores, frameworks, valuations and scenarios are produced
          by a published, automated methodology and describe evidence — they are not predictions. If you need advice, speak to an authorised financial adviser.
        </p>
      </S>
      <S h="Accuracy of data">
        <p>
          Figures come from public filings and third-party data providers, and each is labelled with its source and date. Data can be delayed, incomplete or wrong. Figures marked DEMO DATA are illustrative only.
          Always check important figures against the original filing before relying on them.
        </p>
      </S>
      <S h="Free beta">
        <p>The service is provided free, “as is”, during the beta. Features may change or be withdrawn, and the site may be unavailable at times.</p>
      </S>
      <S h="Acceptable use">
        <p>Please don’t attempt to disrupt the service, scrape it at high volume, or use it for anything unlawful.</p>
      </S>
      <S h="Liability">
        <p>To the extent permitted by law, we are not liable for investment losses or decisions made using information from this website. Nothing in these terms limits liability that cannot legally be limited.</p>
      </S>
      <S h="Governing law">
        <p>These terms are governed by the laws of England and Wales.</p>
      </S>
    </article>
  )
}
