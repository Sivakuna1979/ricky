import type { Capability, DataProvider } from './types'
import { fmpProvider } from './fmp'
import { secEdgarProvider } from './sec-edgar'
import { alphaVantageProvider } from './alpha-vantage'

/**
 * All known adapters. Add Polygon, Finnhub, Tiingo, Twelve Data,
 * Nasdaq Data Link or FRED by implementing `DataProvider` and listing it here.
 */
const ALL: DataProvider[] = [secEdgarProvider, fmpProvider, alphaVantageProvider]

/**
 * DATA_PROVIDER_PRIORITY (comma-separated ids) controls which configured
 * adapter wins for each capability. Default: SEC EDGAR first (primary-source
 * filings) for financials/profile/filings, then FMP, then Alpha Vantage.
 */
function priority(): string[] {
  return (process.env.DATA_PROVIDER_PRIORITY ?? 'sec-edgar,fmp,alpha-vantage')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function configuredProviders(): DataProvider[] {
  const order = priority()
  return ALL.filter((p) => p.isConfigured()).sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

export function providerFor(cap: Capability): DataProvider | null {
  return configuredProviders().find((p) => p.capabilities.includes(cap)) ?? null
}

export function providerStatus() {
  return ALL.map((p) => ({ id: p.id, name: p.name, configured: p.isConfigured(), capabilities: p.capabilities }))
}
