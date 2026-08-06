import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Vitalnova - Sistema de Gestión',
  description: 'Sistema de gestión para Droguería y Distribuidora de Medicamentos',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1A1A2E',
              color: '#fff',
              borderRadius: '8px',
            },
            success: { style: { background: '#003087' } },
            error: { style: { background: '#E31837' } },
          }}
        />
      </body>
    </html>
  )
}
