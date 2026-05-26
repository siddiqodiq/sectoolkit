import { RouteGuard } from '@/components/route-guard'
import '../../app/globals.css'
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Database - CVEs and Payloads",
  description: "Database to see payload and other information",
  icons: {
    icon: "logo.ico",
    shortcut: "logo.ico",
    apple: "/apple-touch-icon.png",
  },
}

export default function DatabaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="database-container">
        <RouteGuard requireAuth>
      {children}
      </RouteGuard>
    </div>

  )
}