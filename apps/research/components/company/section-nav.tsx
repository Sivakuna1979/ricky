const ITEMS: [string, string][] = [
  ['score', 'Score'],
  ['summary', 'Summary'],
  ['thesis', 'Thesis'],
  ['overview', 'Business'],
  ['statements', 'Statements'],
  ['growth', 'Growth'],
  ['profitability', 'Profitability'],
  ['cash-flow', 'Cash flow'],
  ['balance-sheet', 'Balance sheet'],
  ['valuation', 'Valuation'],
  ['dcf', 'DCF'],
  ['moat', 'Moat'],
  ['management', 'Management'],
  ['dividend', 'Dividend'],
  ['competitors', 'Competitors'],
  ['industry', 'Industry'],
  ['risk', 'Risk'],
  ['frameworks', 'Investor frameworks'],
  ['technical', 'Technical'],
  ['analysts', 'Analysts'],
  ['earnings', 'Earnings'],
  ['filings', 'Filings'],
  ['news', 'News'],
  ['outlook', 'Outlook'],
  ['scenarios', 'Scenarios'],
  ['performance', 'Performance'],
  ['checklist', 'Checklist'],
  ['picture', 'Summary'],
  ['data-quality', 'Data quality'],
]

export function SectionNav() {
  return (
    <nav aria-label="Analysis sections" className="sticky top-14 z-30 -mx-4 border-b border-ink-700/80 bg-ink-950/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <ul className="scrollbar-thin flex gap-1 overflow-x-auto py-2">
        {ITEMS.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-fg-3 hover:bg-ink-800 hover:text-fg">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
