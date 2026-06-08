import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['700', '800'] })

export const metadata: Metadata = {
  title: {
    default: 'Food Taxi — Find Mobile Food Vans Near You',
    template: '%s | Food Taxi',
  },
  description: 'Track mobile food vans, order online, and manage your mobile food business all in one platform.',
  keywords: ['mobile food van', 'fish and chips van', 'burger van', 'coffee van', 'food truck near me'],
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'Food Taxi',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${syne.variable} font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
