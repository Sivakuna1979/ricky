import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentHub — WhatsApp & Telegram AI Agents',
  description:
    'Build AI agents that talk to your customers on WhatsApp and Telegram. Voice, knowledge base, Google Workspace, scheduled jobs and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
