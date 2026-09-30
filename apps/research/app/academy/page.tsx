import { PlannedModule } from '@/components/layout/planned-module'

export const metadata = { title: 'Investment Academy' }

export default function Page() {
  return (
    <PlannedModule
      title="Investment Academy"
      phase="Build phase 10"
      summary="Plain-language lessons on how to read a company — written in original language, inspired by concepts from classic investing literature rather than copying it."
      scope={[
        'Financial statements, revenue, profit, free cash flow, ROIC, ROE, debt',
        'Valuation: P/E, PEG, DCF, margin of safety',
        'Economic moats, compounding, risk and diversification',
        'Concept guides inspired by The Intelligent Investor, Security Analysis, Common Stocks and Uncommon Profits, One Up on Wall Street, The Little Book That Beats the Market, Buffett’s shareholder letters, Poor Charlie’s Almanack, The Most Important Thing, Margin of Safety, Quality Investing and The Psychology of Money',
        'Behavioural finance: FOMO, loss aversion, anchoring, confirmation, recency, overconfidence, herding',
      ]}
    />
  )
}
