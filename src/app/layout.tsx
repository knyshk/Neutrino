import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from 'next-themes'
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
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Neutrino',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ErrorBoundary>
            <ToastProvider>{children}</ToastProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
