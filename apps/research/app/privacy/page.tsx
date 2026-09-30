export const metadata = { title: 'Privacy' }

/** Plain-English starting template — have it reviewed by a qualified person before charging or collecting accounts. */
export default function PrivacyPage() {
  const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{h}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-fg-2">{children}</div>
    </section>
  )
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Privacy notice</h1>
        <p className="mt-1 text-sm text-fg-4">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </header>
      <S h="Who we are">
        <p>Evidentia Research (“we”) runs this website. Contact: use the email address shown on this site for privacy questions.</p>
      </S>
      <S h="What we collect during the free beta">
        <p>
          <strong className="text-fg">No account is required and we do not ask for your name, email or payment details.</strong> Watchlists, portfolios and alerts you create are stored only in your own browser
          (local storage) and are not sent to us.
        </p>
        <p>Like any website, our hosting provider (Vercel) processes technical data such as IP addresses and request logs to deliver and secure the site. We use this only for security and reliability.</p>
        <p>We do not use advertising or tracking cookies.</p>
      </S>
      <S h="Questions you ask the AI assistant">
        <p>If the AI assistant is enabled with an external AI provider, the text of your question and the company data it refers to are sent to that provider to generate an answer. Please don’t include personal information in questions.</p>
      </S>
      <S h="Your rights">
        <p>Under UK data protection law you can ask what personal data we hold about you and ask us to delete it. Because the beta stores your saved items in your browser, you can delete them yourself by clearing this site’s data in your browser.</p>
        <p>You can also complain to the Information Commissioner’s Office (ico.org.uk).</p>
      </S>
      <S h="Changes">
        <p>If we add accounts or payments, we will update this notice before collecting any new information.</p>
      </S>
    </article>
  )
}
