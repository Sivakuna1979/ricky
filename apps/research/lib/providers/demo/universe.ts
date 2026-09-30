/**
 * DEMO universe of company snapshots used for peer tables, homepage lists and
 * search suggestions while no live provider is connected. Illustrative only.
 */
import type { CompanySnapshot, IndustryBenchmarks } from '@/lib/domain/types'

const B = 1e9
const T = 1e12

type S = Omit<CompanySnapshot, 'sourceId' | 'country'> & { country?: string }

const rows: S[] = [
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software — Infrastructure', exchange: 'NASDAQ', marketCap: 3.8 * T, revenue: 281.7 * B, revenueGrowth: 14.9, pe: 37, forwardPe: 33, operatingMargin: 45.6, netMargin: 36.1, roe: 33, roic: 27, totalDebt: 60 * B, netDebt: -34 * B, fcf: 71.6 * B, fcfGrowth: 1.5, fcfYield: 1.9, evToEbitda: 23, dividendYield: 0.7, price: 510, epsGrowth: 15, peg: 2.3, ps: 13.5, grossMargin: 69, debtToEquity: 0.2 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ', marketCap: 4.4 * T, revenue: 165 * B, revenueGrowth: 60, pe: 50, forwardPe: 32, operatingMargin: 60, netMargin: 53, roe: 95, roic: 80, totalDebt: 10 * B, netDebt: -50 * B, fcf: 72 * B, fcfGrowth: 50, fcfYield: 1.6, evToEbitda: 40, dividendYield: 0.02, price: 180, epsGrowth: 100, peg: 1.2, ps: 27, grossMargin: 75, debtToEquity: 0.1 },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical', industry: 'Internet Retail & Cloud', exchange: 'NASDAQ', marketCap: 2.4 * T, revenue: 690 * B, revenueGrowth: 11, pe: 34, forwardPe: 30, operatingMargin: 11.5, netMargin: 10.5, roe: 22, roic: 14, totalDebt: 130 * B, netDebt: 40 * B, fcf: 18 * B, fcfGrowth: -50, fcfYield: 0.8, evToEbitda: 16, dividendYield: 0, price: 225, epsGrowth: 50, peg: 1.6, ps: 3.5, grossMargin: 49, debtToEquity: 0.4 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Internet Content & Information', exchange: 'NASDAQ', marketCap: 2.9 * T, revenue: 385 * B, revenueGrowth: 13, pe: 26, forwardPe: 24, operatingMargin: 32.5, netMargin: 31, roe: 33, roic: 28, totalDebt: 25 * B, netDebt: -70 * B, fcf: 70 * B, fcfGrowth: 5, fcfYield: 2.4, evToEbitda: 18, dividendYield: 0.35, price: 240, epsGrowth: 30, peg: 1.2, ps: 7.5, grossMargin: 59, debtToEquity: 0.08 },
  { ticker: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services', industry: 'Internet Content & Information', exchange: 'NASDAQ', marketCap: 1.85 * T, revenue: 190 * B, revenueGrowth: 20, pe: 27, forwardPe: 24, operatingMargin: 41, netMargin: 37, roe: 36, roic: 30, totalDebt: 29 * B, netDebt: -15 * B, fcf: 45 * B, fcfGrowth: -15, fcfYield: 2.4, evToEbitda: 16, dividendYield: 0.3, price: 740, epsGrowth: 35, peg: 1.1, ps: 9.7, grossMargin: 82, debtToEquity: 0.2 },
  { ticker: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', exchange: 'NASDAQ', marketCap: 1.4 * T, revenue: 95 * B, revenueGrowth: -2, pe: 180, forwardPe: 150, operatingMargin: 5.5, netMargin: 6, roe: 8, roic: 6, totalDebt: 13 * B, netDebt: -24 * B, fcf: 6 * B, fcfGrowth: -20, fcfYield: 0.4, evToEbitda: 100, dividendYield: 0, price: 440, epsGrowth: -50, peg: null, ps: 14.7, grossMargin: 17.5, debtToEquity: 0.17 },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Drug Manufacturers', exchange: 'NYSE', marketCap: 450 * B, revenue: 92 * B, revenueGrowth: 5, pe: 18, forwardPe: 16, operatingMargin: 25, netMargin: 25, roe: 30, roic: 18, totalDebt: 45 * B, netDebt: 25 * B, fcf: 19 * B, fcfGrowth: 3, fcfYield: 4.2, evToEbitda: 14, dividendYield: 2.8, price: 187, epsGrowth: 5, peg: 3.0, ps: 4.9, grossMargin: 69, debtToEquity: 0.6 },
  { ticker: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Defensive', industry: 'Beverages — Non-Alcoholic', exchange: 'NYSE', marketCap: 300 * B, revenue: 47 * B, revenueGrowth: 2, pe: 24, forwardPe: 22, operatingMargin: 29, netMargin: 26, roe: 40, roic: 16, totalDebt: 45 * B, netDebt: 33 * B, fcf: 5 * B, fcfGrowth: -40, fcfYield: 1.7, evToEbitda: 21, dividendYield: 2.9, price: 70, epsGrowth: 5, peg: 3.8, ps: 6.4, grossMargin: 61, debtToEquity: 1.7 },
  { ticker: 'COST', name: 'Costco Wholesale Corporation', sector: 'Consumer Defensive', industry: 'Discount Stores', exchange: 'NASDAQ', marketCap: 420 * B, revenue: 275 * B, revenueGrowth: 8, pe: 50, forwardPe: 46, operatingMargin: 3.8, netMargin: 2.9, roe: 30, roic: 22, totalDebt: 8 * B, netDebt: -7 * B, fcf: 7.5 * B, fcfGrowth: 7, fcfYield: 1.8, evToEbitda: 30, dividendYield: 0.5, price: 945, epsGrowth: 11, peg: 4.4, ps: 1.5, grossMargin: 13, debtToEquity: 0.3 },
]

export const DEMO_UNIVERSE: CompanySnapshot[] = rows.map((r) => ({ country: 'United States', ...r, sourceId: 'demo-peers' }))

/** Default peer set for the Apple demo (spans devices, platforms and services). */
export const APPLE_PEERS = ['MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA']

export const DEMO_INDUSTRY_TECH: IndustryBenchmarks = {
  label: 'Technology hardware & platforms (demo median)',
  sourceId: 'demo-industry',
  grossMargin: 38,
  operatingMargin: 18,
  netMargin: 14,
  roic: 15,
  roe: 20,
  revenueGrowth: 6,
  pe: 26,
  forwardPe: 23,
  ps: 3.5,
  pb: 6,
  evToEbitda: 17,
  pfcf: 25,
  currentRatio: 1.4,
  debtToEquity: 0.8,
}
