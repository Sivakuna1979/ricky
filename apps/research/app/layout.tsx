import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

export const metadata: Metadata = {
  title: { default: 'Evidentia — Invest With Evidence, Not Emotion', template: '%s · Evidentia' },
  description: 'Deep fundamental analysis, valuation, risk and investor frameworks — explained in one place.',
}

export const viewport: Viewport = { themeColor: '#060a13' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
