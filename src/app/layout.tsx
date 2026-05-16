import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Neutrino — AI-Powered Knowledge Workspace',
  description:
    'Capture notes, record meetings, and upload documents — then have a conversation with all of it.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
