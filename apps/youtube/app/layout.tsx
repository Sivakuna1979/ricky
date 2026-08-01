import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YouTube Channel Automation',
  description:
    'Automated, policy-compliant YouTube content production — topic research, scripting, voice-over, rendering, thumbnails, upload and analytics, with human approval built in.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
