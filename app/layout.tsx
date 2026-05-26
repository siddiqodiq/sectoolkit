// app/layout.tsx
import './landing.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login - Pusdatin Security Toolkit",
  description: "Login to Pusdatin Security Toolkit",
  icons: {
    icon: "logo.ico",
    shortcut: "logo.ico",
    apple: "/apple-touch-icon.png",
  },
}

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-black`}>
        <Providers>
          <div className="landing-container">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}