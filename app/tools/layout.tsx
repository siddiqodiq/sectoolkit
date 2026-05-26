// app/tools/layout.tsx

import { RouteGuard } from '@/components/route-guard'

import type { Metadata } from "next"
import "../../app/globals.css"

export const metadata: Metadata = {
  title: "Pentesting Tools",
  description: "Collection of security tools for penetration testing and vulnerability assessment",
  icons: {
    icon: "logo.ico",
    shortcut: "logo.ico",
    apple: "/apple-touch-icon.png",
  },
}

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RouteGuard requireAuth>
      {children}
    </RouteGuard>
  )
}