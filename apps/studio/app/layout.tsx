import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Studio — AI photo & video editor', template: '%s · Studio' },
  description: 'Edit photos and videos by describing what you want. Editing runs in your browser; your full-size files are never uploaded.',
}

export const viewport: Viewport = { themeColor: '#08080b' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  )
}
