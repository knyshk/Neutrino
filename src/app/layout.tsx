import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata: Metadata = {
  title: {
    default: 'Neutrino — AI-Powered Knowledge Workspace',
    template: '%s | Neutrino',
  },
  description:
    'Capture notes, record meetings, and upload documents — then have a conversation with all of it.',
  openGraph: {
    title: 'Neutrino — AI-Powered Knowledge Workspace',
    description:
      'Capture notes, record meetings, and upload documents — then have a conversation with all of it.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <ErrorBoundary>
          <ToastProvider>{children}</ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
