'use client'

import { I18nProvider } from 'react-aria-components'

export function Providers({ children }: { children: React.ReactNode }) {
  // Locale es-AR: los campos de fecha (react-aria) usan formato dd/mm/aaaa
  return <I18nProvider locale="es-AR">{children}</I18nProvider>
}
