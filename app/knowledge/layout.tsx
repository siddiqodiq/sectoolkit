// app/knowledge/layout.tsx - Update untuk match tools layout

import { RouteGuard } from '@/components/route-guard'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { Metadata } from "next"
import "../../app/globals.css"

export const metadata: Metadata = {
  title: "Knowledge Base Management",
  description: "Upload, ingest, and manage your knowledge base files for enhanced AI responses",
  icons: {
    icon: "logo.ico",
    shortcut: "logo.ico",
    apple: "/apple-touch-icon.png",
  },
}

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <RouteGuard requireAuth>
        {children}
      </RouteGuard>
    </SidebarProvider>
  )
}