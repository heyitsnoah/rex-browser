import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

import { Geist, Geist_Mono } from 'next/font/google'

import { Toaster } from '@/components/ui/sonner'
import { skipLayoutAccess } from '@/rex/rex-access'
import { appName } from '@/utils/app-name'
import { AppProviders } from '@/workspace/components/app-providers'

const fontSans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const fontMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
}

export const viewport: Viewport = {
  viewportFit: 'cover',
  width: 'device-width',
}

export default skipLayoutAccess((props: { readonly children: ReactNode }) => {
  return (
    <html
      className={`${fontMono.variable} ${fontSans.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans">
        <AppProviders>
          {props.children}
          <Toaster richColors />
        </AppProviders>
      </body>
    </html>
  )
})
